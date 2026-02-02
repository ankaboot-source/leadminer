import { User } from "@supabase/supabase-js";
import { NextFunction, Request, Response } from "express";
import { decode } from "jsonwebtoken";
import ENV from "../config";
import { Contacts } from "../db/interfaces/Contacts";
import {
  MiningSources,
  OAuthMiningSourceProvider,
} from "../db/interfaces/MiningSources";
import RedisQueuedEmailsCache from "../services/cache/redis/RedisQueuedEmailsCache";
import { ContactFormat } from "../services/extractors/engines/FileImport";
import TaskManagerFile from "../services/tasks-manager/TaskManagerFile";
import TasksManager from "../services/tasks-manager/TasksManager";
import TasksManagerPST from "../services/tasks-manager/TasksManagerPST";
import { Task } from "../services/tasks-manager/types";
import { ImapAuthError } from "../utils/errors";
import validateType from "../utils/helpers/validation";
import logger from "../utils/logger";
import redis from "../utils/redis";
import RedisStreamProducer from "../utils/streams/redis/RedisStreamProducer";
import supabaseClient from "../utils/supabase";
import { EmailVerificationData } from "../workers/email-verification/emailVerificationHandlers";
import {
  generateErrorObjectFromImapError,
  getValidImapLogin,
  sanitizeImapInput,
} from "./imap.helpers";
import {
  getAuthClient,
  getTokenConfig,
  getTokenWithScopeValidation,
  validateFileContactsData,
} from "./mining.helpers";

/**
 * Exchanges an OAuth authorization code for tokens and extracts user email
 *
 * @param code - The authorization code received from OAuth provider
 * @param provider - The OAuth provider name (e.g., 'google', 'microsoft')
 */
async function exchangeForToken(
  code: string,
  provider: OAuthMiningSourceProvider,
) {
  const tokenConfig = {
    ...getTokenConfig(provider),
    code,
  };
  const { refreshToken, accessToken, idToken, expiresAt } =
    await getTokenWithScopeValidation(tokenConfig, provider);
  const { email } = decode(idToken) as { email: string };

  return {
    email,
    accessToken,
    refreshToken,
    expiresAt,
  };
}

async function publishPreviouslyUnverifiedEmailsToCleaning(
  contacts: Contacts,
  userId: string,
  miningId: string,
  emailStream: string,
) {
  const redisClient = redis.getClient();
  const queuedEmailsCache = new RedisQueuedEmailsCache(redisClient, miningId);
  const producer = new RedisStreamProducer<EmailVerificationData>(
    redisClient,
    emailStream,
    logger,
  );
  logger.debug("Starting re-publication of unverified contacts", {
    userId,
    miningId,
    emailStream,
  });
  let emailsToVerify = 0;
  try {
    const unverifiedContacts = await contacts.getUnverifiedContacts(userId, []);

    if (!unverifiedContacts || unverifiedContacts.length === 0) {
      logger.debug("No unverified contacts found to re-publish", {
        userId,
        miningId,
      });
      return emailsToVerify;
    }

    const toPublish = (
      await queuedEmailsCache.addMany(
        unverifiedContacts.map(({ email }) => email),
      )
    ).addedElements.map((e) => ({
      email: e,
      userId,
      miningId,
    }));

    emailsToVerify += toPublish.length;

    logger.debug("Publishing unverified contacts to cleaning stream", {
      userId,
      miningId,
      count: toPublish.length,
    });

    await producer.produce(toPublish);

    logger.debug("Successfully re-published contacts for cleaning", {
      userId,
      miningId,
      count: toPublish.length,
    });

    return emailsToVerify;
  } catch (error) {
    logger.error("Failed to re-publish unverified contacts", {
      userId,
      miningId,
      error,
    });
    throw error; // Re-throw to handle failure at the caller level
  }
}

export default function initializeMiningController(
  tasksManager: TasksManager,
  tasksManagerFile: TaskManagerFile,
  tasksManagerPST: TasksManagerPST,
  miningSources: MiningSources,
  contactsDB: Contacts,
) {
  return {
    async createProviderMiningSource(req: Request, res: Response) {
      const user = res.locals.user as User;
      const provider = req.params.provider as OAuthMiningSourceProvider;
      const { redirect } = req.body;

      const stateObj = JSON.stringify({
        userId: user.id,
        afterCallbackRedirect: redirect ?? "/",
      });

      const authorizationUri = getAuthClient(provider).authorizeURL({
        ...getTokenConfig(provider),
        state: Buffer.from(stateObj).toString("base64"),
      });

      return res.json({ authorizationUri });
    },

    async createProviderMiningSourceCallback(req: Request, res: Response) {
      const { code, state } = req.query as { code: string; state: string };
      const provider = req.params.provider as OAuthMiningSourceProvider;
      let redirect = "/";
      try {
        const {
          userId,
          afterCallbackRedirect,
        }: {
          userId: string;
          afterCallbackRedirect: string;
        } = JSON.parse(
          Buffer.from(state as string, "base64").toString("utf-8"),
        );

        redirect = afterCallbackRedirect;
        const exchangedTokens = await exchangeForToken(code, provider);

        await miningSources.upsert({
          userId,
          email: exchangedTokens.email,
          credentials: {
            ...exchangedTokens,
            provider,
          },
          type: provider,
        });
        redirect = afterCallbackRedirect.startsWith("/mine")
          ? `${afterCallbackRedirect}?source=${exchangedTokens.email}`
          : afterCallbackRedirect;
        res.redirect(301, `${ENV.FRONTEND_HOST}${redirect}`);
      } catch (error) {
        logger.error(error);
        res.redirect(
          301,
          `${ENV.FRONTEND_HOST}/callback?error=oauth-permissions&provider=${provider}&referrer=${state}&navigate_to=${redirect}`,
        );
      }
    },

    async createImapMiningSource(
      req: Request,
      res: Response,
      next: NextFunction,
    ) {
      const user = res.locals.user as User;
      const {
        email,
        host,
        password,
        port,
        secure,
      }: {
        email: string;
        host: string;
        password: string;
        port: number;
        secure: boolean;
      } = req.body;

      const errors = [
        validateType("email", email, "string"),
        validateType("host", host, "string"),
        validateType("password", password, "string"),
        validateType("port", port, "number"),
        validateType("secure", secure, "boolean"),
      ].filter(Boolean);

      if (errors.length) {
        return res
          .status(400)
          .json({ message: `Invalid input: ${errors.join(", ")}` });
      }

      const sanitizedHost = sanitizeImapInput(host);
      const sanitizedEmail = sanitizeImapInput(email);
      const sanitizedPassword = password;

      try {
        // Validate & Get the valid IMAP login connection before creating the pool.
        const login = await getValidImapLogin(
          sanitizedHost,
          sanitizedEmail,
          sanitizedPassword,
          port,
          secure,
        );

        await miningSources.upsert({
          userId: user.id,
          email: sanitizedEmail,
          type: "imap",
          credentials: {
            port,
            tls: secure,
            email: login,
            host: sanitizedHost,
            password: sanitizedPassword,
          },
        });

        return res
          .status(201)
          .send({ message: "IMAP mining source added successfully" });
      } catch (error) {
        if (error instanceof ImapAuthError) {
          return res
            .status(error.status)
            .json({ message: error.message, fields: error.fields });
        }

        res.status(500);
        return next(error);
      }
    },

    async getMiningSources(_req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;

      try {
        const sourcesData = await miningSources.getByUser(user.id);

        const sources = sourcesData.map((s) => ({
          email: s.email,
          type: s.type,
          passive_mining: s.passive_mining,
        }));

        return res.status(200).send({
          message: "Mining sources retrieved successfully",
          sources,
        });
      } catch (error) {
        res.status(500);
        return next(error);
      }
    },

    async startMining(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;

      const {
        extractSignatures,
        miningSource: { email },
        boxes: folders,
      }: {
        miningSource: {
          email: string;
        };
        boxes: string[];
        extractSignatures: boolean;
      } = req.body;

      const errors = [
        validateType("email", email, "string"),
        validateType("boxes", folders, "string[]"),
        validateType("extractSignatures", extractSignatures, "boolean"),
      ].filter(Boolean);

      if (errors.length) {
        return res
          .status(400)
          .json({ message: `Invalid input: ${errors.join(", ")}` });
      }

      const sanitizedEmail = sanitizeImapInput(email);
      const sanitizedFolders = folders.map((folder) =>
        sanitizeImapInput(folder)
      );

      const miningSourceCredentials = await miningSources
        .getCredentialsBySourceEmail(
          user.id,
          sanitizedEmail,
        );

      if (!miningSourceCredentials) {
        return res.status(401).json({
          message: "This mining source isn't registered for this user",
        });
      }

      try {
        const miningTask = await tasksManager.createTask({
          boxes: sanitizedFolders,
          userId: user.id,
          email: miningSourceCredentials.email,
          fetchEmailBody: extractSignatures,
        });

        const taskObject = tasksManager.getTaskOrThrow(miningTask.miningId);
        const { userId, miningId } = taskObject;
        const totalPublished =
          await publishPreviouslyUnverifiedEmailsToCleaning(
            contactsDB,
            userId,
            miningId,
            taskObject.process.clean.details.stream.emailsStream,
          );
        taskObject.progress.createdContacts += totalPublished;
        taskObject.process.clean.details.progress.createdContacts +=
          totalPublished;

        return res.status(201).send({ error: null, data: miningTask });
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.toLowerCase().startsWith("invalid credentials")
        ) {
          return res.status(401).json({ message: err.message });
        }
        if (
          err instanceof Error &&
          "textCode" in err &&
          err.textCode === "CANNOT"
        ) {
          return res.sendStatus(409);
        }

        const newError = generateErrorObjectFromImapError(err);

        res.status(500);
        return next(new Error(newError.message));
      }
    },

    async startMiningFile(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;

      const {
        name,
        contacts,
      }: {
        name: string;
        contacts: Partial<ContactFormat[]>;
      } = req.body;

      try {
        try {
          validateFileContactsData(contacts);
        } catch (error) {
          let message = "Invalid contacts data";
          if (error instanceof Error) {
            message = error.message;
          }
          return res.status(400).json({ message });
        }

        const errors = [validateType("name", name, "string")].filter(Boolean);

        if (errors.length) {
          return res
            .status(400)
            .json({ message: `Invalid input: ${errors.join(", ")}` });
        }

        const fileMiningTask = await tasksManagerFile.createTask(
          user.id,
          name,
          1,
        );

        const taskObject = tasksManagerFile.getTaskOrThrow(
          fileMiningTask.miningId,
        );
        const { userId, miningId } = taskObject;

        const totalPublished =
          await publishPreviouslyUnverifiedEmailsToCleaning(
            contactsDB,
            userId,
            miningId,
            taskObject.process.clean.details.stream.emailsStream,
          );
        taskObject.progress.createdContacts += totalPublished;
        taskObject.process.clean.details.progress.createdContacts +=
          totalPublished;

        // Publish contacts to extracting redis stream
        await redis.getClient().xadd(
          `messages_stream-${fileMiningTask.miningId}`,
          "*",
          "message",
          JSON.stringify({
            type: "file",
            miningId: fileMiningTask.miningId,
            userId: user.id,
            userEmail: user.email,
            data: {
              fileName: name,
              contacts,
            },
          }),
        );

        return res.status(201).send({
          error: null,
          data: fileMiningTask,
        });
      } catch (err) {
        res.status(500);
        return next(err);
      }
    },

    async startMiningPST(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;

      const {
        name,
        extractSignatures,
      }: {
        name: string;
        extractSignatures: boolean;
        // file
      } = req.body;

      const errors = [
        validateType("name", name, "string"),
        validateType("extractSignatures", extractSignatures, "boolean"),
      ].filter(Boolean);

      if (errors.length) {
        return res
          .status(400)
          .json({ message: `Invalid input: ${errors.join(", ")}` });
      }
      try {
        const miningTask = await tasksManagerPST.createTask(
          user.id,
          name,
          extractSignatures,
        );

        const taskObject = tasksManagerPST.getTaskOrThrow(miningTask.miningId);
        const { userId, miningId } = taskObject;
        const totalPublished =
          await publishPreviouslyUnverifiedEmailsToCleaning(
            contactsDB,
            userId,
            miningId,
            taskObject.process.clean.details.stream.emailsStream,
          );
        taskObject.progress.createdContacts += totalPublished;
        taskObject.process.clean.details.progress.createdContacts +=
          totalPublished;

        return res.status(201).send({ error: null, data: miningTask });
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.toLowerCase().startsWith("invalid credentials")
        ) {
          return res.status(401).json({ message: err.message });
        }
        if (
          err instanceof Error &&
          "textCode" in err &&
          err.textCode === "CANNOT"
        ) {
          return res.sendStatus(409);
        }

        res.status(500);
        return next(err);
      }
    },

    async stopMiningTask(req: Request, res: Response, next: NextFunction) {
      const { type: miningType } = req.params;
      const { user } = res.locals;

      if (!user) {
        res.status(404);
        return next(new Error("user does not exists."));
      }

      let manager;
      if (miningType === "file") {
        manager = tasksManagerFile;
      } else if (miningType === "pst") {
        manager = tasksManagerPST;
      } else {
        manager = tasksManager;
      }

      const { id: taskId } = req.params;
      const {
        processes,
        endEntireTask,
      }: {
        processes: string[];
        endEntireTask: boolean;
      } = req.body;

      if (!endEntireTask && !Array.isArray(processes)) {
        return res.status(400).json({
          error: { message: "processes should be an array of strings" },
        });
      }

      try {
        const task = manager.getActiveTask(taskId);

        if (user.id !== task.userId) {
          return res
            .status(401)
            .json({ error: { message: "User not authorized." } });
        }

        const deletedTask = await manager.deleteTask(
          taskId,
          endEntireTask ? null : processes,
        );

        return res.status(200).json({ data: deletedTask });
      } catch (err) {
        res.status(404);
        return next(err);
      }
    },

    async getMiningTask(req: Request, res: Response, next: NextFunction) {
      const { user } = res.locals;
      try {
        const { data: userActiveTasks, error } = await supabaseClient
          .schema("private")
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(4);

        if (error || !userActiveTasks || userActiveTasks.length === 0) {
          throw new Error("Unable to get active mining task");
        }

        const fetchTask = (userActiveTasks as Task[]).find(
          (t) => t.type === "fetch",
        );
        const extractTask = (userActiveTasks as Task[]).find(
          (t) => t.type === "extract",
        );
        const cleanTask = (userActiveTasks as Task[]).find(
          (t) => t.type === "clean",
        );

        const miningId = extractTask?.details?.miningId;

        if (!miningId) {
          throw new Error("Mining id not found");
        }

        let task = null;

        try {
          task = tasksManager.getActiveTask(miningId);
        } catch (err) {
          logger.error(
            `Task not found in tasksManager for miningId=${miningId}`,
          );
        }

        if (!task) {
          try {
            task = tasksManagerFile.getActiveTask(miningId);
          } catch (err) {
            logger.error(
              `Task not found in tasksManagerFile for miningId=${miningId}`,
            );
          }
        }

        if (!task) {
          throw new Error(`No active task found for miningId=${miningId}`);
        }

        if (
          task.miningSource.type === "email" &&
          (!fetchTask || !extractTask || !cleanTask)
        ) {
          throw new Error(`Email  mining with id: ${miningId} not found`);
        } else if (
          task.miningSource.type === "file" &&
          (!extractTask || !cleanTask)
        ) {
          throw new Error(`File mining with id: ${miningId} not found`);
        } else if (
          task.miningSource.type === "pst" &&
          (!extractTask || !cleanTask)
        ) {
          throw new Error(`PST mining with id: ${miningId} not found`);
        }

        if (user.id !== task.userId) {
          return res
            .status(401)
            .json({ error: { message: "User not authorized." } });
        }

        return res.status(200).send({
          task,
          fetch: fetchTask,
          extract: extractTask,
          clean: cleanTask,
        });
      } catch (err) {
        res.status(404);
        return next(err);
      }
    },
  };
}
