import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import { decode } from 'jsonwebtoken';
import ENV from '../config';
import { Contacts } from '../db/interfaces/Contacts';
import {
  MiningSources,
  OAuthMiningSourceProvider
} from '../db/interfaces/MiningSources';
import RedisQueuedEmailsCache from '../services/cache/redis/RedisQueuedEmailsCache';
import { ContactFormat } from '../services/extractors/engines/FileImport';
import { SupabaseTask as DBTask, TaskType } from '../db/types';
import { ImapAuthError } from '../utils/errors';
import validateType from '../utils/helpers/validation';
import logger from '../utils/logger';
import redis from '../utils/redis';
import RedisStreamProducer from '../utils/streams/redis/RedisStreamProducer';
import supabaseClient from '../utils/supabase';
import { EmailVerificationData } from '../workers/email-verification/emailVerificationHandlers';
import {
  generateErrorObjectFromImapError,
  getValidImapLogin,
  sanitizeImapInput
} from './imap.helpers';
import {
  getAuthClient,
  getTokenConfig,
  getTokenWithScopeValidation,
  validateFileContactsData
} from './mining.helpers';
import { miningSourceService } from '../db/supabase/MiningSourceService';
import { hasEmailVerificationConfigured } from '../services/email-status/EmailStatusVerifierFactory';
import { MiningEngine } from '../services/tasks-manager-v2/MiningEngine';
import { CleanTask } from '../services/tasks-manager-v2/tasks/CleanTask';
import { ExtractTask } from '../services/tasks-manager-v2/tasks/ExtractTask';
import { TaskId } from '../services/tasks-manager-v2/types';
import {
  createImapMining,
  createFileMining,
  createPstMining
} from '../services/tasks-manager-v2/factories';
import { PipelineDeps } from '../services/tasks-manager-v2/Pipeline';
import { FetcherClient } from '../services/tasks-manager-v2/tasks/FetchTask';

export interface MiningControllerDeps {
  pipelineDeps: PipelineDeps;
  emailFetcherClient: FetcherClient;
  pstFetcherClient: FetcherClient;
  idGenerator: () => Promise<string> | string;
}

/**
 * Exchanges an OAuth authorization code for tokens and extracts user email
 *
 * @param code - The authorization code received from OAuth provider
 * @param provider - The OAuth provider name (e.g., 'google', 'microsoft')
 */
async function exchangeForToken(
  code: string,
  provider: OAuthMiningSourceProvider
) {
  const tokenConfig = {
    ...getTokenConfig(provider),
    code
  };
  const { refreshToken, accessToken, idToken, expiresAt } =
    await getTokenWithScopeValidation(tokenConfig, provider);
  const { email } = decode(idToken) as { email: string };

  return {
    email,
    accessToken,
    refreshToken,
    expiresAt
  };
}

function getSafeRedirectPath(path: unknown) {
  if (
    typeof path !== 'string' ||
    !path.startsWith('/') ||
    path.startsWith('//')
  ) {
    return '/';
  }

  return path;
}

function parseOAuthState(state: string | undefined) {
  if (!state) {
    throw new Error('Missing OAuth state.');
  }

  const decoded = Buffer.from(state, 'base64').toString('utf-8');
  const parsed = JSON.parse(decoded) as {
    userId?: string;
    afterCallbackRedirect?: string;
  };

  if (!parsed.userId) {
    throw new Error('Invalid OAuth state payload.');
  }

  return {
    userId: parsed.userId,
    afterCallbackRedirect: getSafeRedirectPath(parsed.afterCallbackRedirect)
  };
}

async function publishPreviouslyUnverifiedEmailsToCleaning(
  contacts: Contacts,
  userId: string,
  miningId: string,
  emailStream: string
) {
  const redisClient = redis.getClient();
  const queuedEmailsCache = new RedisQueuedEmailsCache(redisClient, miningId);
  const producer = new RedisStreamProducer<EmailVerificationData>(
    redisClient,
    emailStream,
    logger
  );
  logger.debug('Starting re-publication of unverified contacts', {
    userId,
    miningId,
    emailStream
  });
  let emailsToVerify = 0;
  try {
    const unverifiedContacts = await contacts.getUnverifiedContacts(userId, []);

    if (!unverifiedContacts || unverifiedContacts.length === 0) {
      logger.debug('No unverified contacts found to re-publish', {
        userId,
        miningId
      });
      return emailsToVerify;
    }

    const toPublish = (
      await queuedEmailsCache.addMany(
        unverifiedContacts.map(({ email }) => email)
      )
    ).addedElements.map((e) => ({
      email: e,
      userId,
      miningId
    }));

    emailsToVerify += toPublish.length;

    logger.debug('Publishing unverified contacts to cleaning stream', {
      userId,
      miningId,
      count: toPublish.length
    });

    await producer.produce(toPublish);

    logger.debug('Successfully re-published contacts for cleaning', {
      userId,
      miningId,
      count: toPublish.length
    });

    return emailsToVerify;
  } catch (error) {
    logger.error('Failed to re-publish unverified contacts', {
      userId,
      miningId,
      error
    });
    throw error; // Re-throw to handle failure at the caller level
  }
}

export default function initializeMiningController(
  miningSources: MiningSources,
  contactsDB: Contacts,
  miningEngine: MiningEngine,
  deps: MiningControllerDeps
) {
  return {
    createProviderMiningSource(req: Request, res: Response) {
      const user = res.locals.user as User;
      const provider = req.params.provider as OAuthMiningSourceProvider;
      const { redirect } = req.body;
      const afterCallbackRedirect = getSafeRedirectPath(redirect);

      const stateObj = JSON.stringify({
        userId: user.id,
        afterCallbackRedirect
      });

      const authorizationUri = getAuthClient(provider).authorizeURL({
        ...getTokenConfig(provider),
        state: Buffer.from(stateObj).toString('base64')
      });

      return res.json({ authorizationUri });
    },

    async createProviderMiningSourceCallback(req: Request, res: Response) {
      const { code, state } = req.query as { code: string; state: string };
      const provider = req.params.provider as OAuthMiningSourceProvider;
      let redirect = '/';
      try {
        const { userId, afterCallbackRedirect } = parseOAuthState(state);

        redirect = afterCallbackRedirect;
        const exchangedTokens = await exchangeForToken(code, provider);

        await miningSources.upsert({
          userId,
          email: exchangedTokens.email,
          credentials: {
            ...exchangedTokens,
            provider
          },
          type: provider
        });
        redirect = afterCallbackRedirect.startsWith('/mine')
          ? `${afterCallbackRedirect}?source=${exchangedTokens.email}`
          : afterCallbackRedirect;
        res.redirect(301, `${ENV.FRONTEND_HOST}${redirect}`);
      } catch (error) {
        logger.error(error);
        res.redirect(
          301,
          `${ENV.FRONTEND_HOST}/callback?error=oauth-permissions&provider=${provider}&referrer=${state}&navigate_to=${redirect}`
        );
      }
    },

    async createImapMiningSource(
      req: Request,
      res: Response,
      next: NextFunction
    ) {
      const user = res.locals.user as User;
      const {
        email,
        host,
        password,
        port,
        secure
      }: {
        email: string;
        host: string;
        password: string;
        port: number;
        secure: boolean;
      } = req.body;

      const errors = [
        validateType('email', email, 'string'),
        validateType('host', host, 'string'),
        validateType('password', password, 'string'),
        validateType('port', port, 'number'),
        validateType('secure', secure, 'boolean')
      ].filter(Boolean);

      if (errors.length) {
        return res
          .status(400)
          .json({ message: `Invalid input: ${errors.join(', ')}` });
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
          secure
        );

        await miningSources.upsert({
          userId: user.id,
          email: sanitizedEmail,
          type: 'imap',
          credentials: {
            port,
            tls: secure,
            email: login,
            host: sanitizedHost,
            password: sanitizedPassword
          }
        });

        return res
          .status(201)
          .send({ message: 'IMAP mining source added successfully' });
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

    async startMining(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;
      const {
        extractSignatures,
        cleaningEnabled,
        miningSource: { email },
        boxes: folders,
        since,
        passive_mining
      }: {
        miningSource: {
          email: string;
        };
        boxes: string[];
        extractSignatures: boolean;
        cleaningEnabled: boolean;
        since?: string;
        passive_mining?: boolean;
      } = req.body;

      user.email = email; // used when user is not provided (edge function req)

      const errors = [
        validateType('email', email, 'string'),
        validateType('boxes', folders, 'string[]'),
        validateType('extractSignatures', extractSignatures, 'boolean'),
        validateType('cleaningEnabled', cleaningEnabled, 'boolean')
      ].filter(Boolean);

      if (errors.length) {
        return res
          .status(400)
          .json({ message: `Invalid input: ${errors.join(', ')}` });
      }

      const sanitizedEmail = sanitizeImapInput(email);
      const sanitizedFolders = folders.map((folder) =>
        sanitizeImapInput(folder)
      );

      const sources = await miningSourceService.getSourcesForUser(
        user.id,
        sanitizedEmail
      );
      const miningSourceCredentials = sources?.pop()?.credentials;

      if (!miningSourceCredentials) {
        return res.status(401).json({
          message: "This mining source isn't registered for this user"
        });
      }

      const effectiveCleaningEnabled =
        cleaningEnabled && hasEmailVerificationConfigured(ENV);

      try {
        const miningId = await deps.idGenerator();

        const pipeline = createImapMining(
          {
            miningId,
            userId: user.id,
            email: miningSourceCredentials.email,
            boxes: sanitizedFolders,
            fetchEmailBody: extractSignatures,
            cleaningEnabled: effectiveCleaningEnabled,
            since,
            passiveMining: passive_mining ?? false,
            fetcherClient: deps.emailFetcherClient
          },
          deps.pipelineDeps
        );

        const miningTask = await miningEngine.submit(pipeline);

        const { userId } = miningTask;

        if (effectiveCleaningEnabled) {
          const cleanTask = pipeline.getTask<CleanTask>(TaskId.Clean);
          const emailStream = cleanTask?.streams?.input[0]?.streamName;

          if (emailStream) {
            const totalPublished =
              await publishPreviouslyUnverifiedEmailsToCleaning(
                contactsDB,
                userId,
                miningId,
                emailStream
              );
            const extractTask = pipeline.getTask<ExtractTask>(TaskId.Extract);
            if (extractTask) {
              extractTask.addCreatedContacts(totalPublished);
            }
          }
        }

        return res.status(201).send({ error: null, data: miningTask });
      } catch (err) {
        if (
          err instanceof Error &&
          'textCode' in err &&
          err.textCode === 'CANNOT'
        ) {
          return res.sendStatus(409);
        }

        if (
          err instanceof Error &&
          err.message.includes('Request failed with status code 401')
        ) {
          res
            .status(401)
            .send('Failed to start fetching: Invalid credentials 401');
        }

        if (
          err instanceof Error &&
          err.message.includes('Request failed with status code 503')
        ) {
          res
            .status(503)
            .send(
              'Failed to start fetching: Connection not available, please try again later 503'
            );
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
        cleaningEnabled
      }: {
        name: string;
        contacts: Partial<ContactFormat[]>;
        cleaningEnabled: boolean;
      } = req.body;

      try {
        try {
          validateFileContactsData(contacts);
        } catch (error) {
          let message = 'Invalid contacts data';
          if (error instanceof Error) {
            message = error.message;
          }
          return res.status(400).json({ message });
        }

        const errors = [
          validateType('name', name, 'string'),
          validateType('cleaningEnabled', cleaningEnabled, 'boolean')
        ].filter(Boolean);

        if (errors.length) {
          return res
            .status(400)
            .json({ message: `Invalid input: ${errors.join(', ')}` });
        }

        const effectiveCleaningEnabled =
          cleaningEnabled && hasEmailVerificationConfigured(ENV);

        const miningId = await deps.idGenerator();

        const pipeline = createFileMining(
          {
            miningId,
            userId: user.id,
            fileName: name,
            totalImported: contacts.length,
            cleaningEnabled: effectiveCleaningEnabled
          },
          deps.pipelineDeps
        );

        const fileMiningTask = await miningEngine.submit(pipeline);

        const { userId } = fileMiningTask;

        if (effectiveCleaningEnabled) {
          const cleanTask = pipeline.getTask<CleanTask>(TaskId.Clean);
          const emailStream = cleanTask?.streams?.input[0]?.streamName;

          if (emailStream) {
            const totalPublished =
              await publishPreviouslyUnverifiedEmailsToCleaning(
                contactsDB,
                userId,
                miningId,
                emailStream
              );
            const extractTask = pipeline.getTask<ExtractTask>(TaskId.Extract);
            if (extractTask) {
              extractTask.addCreatedContacts(totalPublished);
            }
          }
        }

        // Publish contacts individually to extracting redis stream
        const redisPipeline = redis.getClient().pipeline();
        for (const contact of contacts) {
          redisPipeline.xadd(
            `messages_stream-${fileMiningTask.miningId}`,
            '*',
            'message',
            JSON.stringify({
              type: 'file',
              miningId: fileMiningTask.miningId,
              userId: user.id,
              userEmail: user.email,
              data: {
                fileName: name,
                contacts: [contact]
              }
            })
          );
        }
        await redisPipeline.exec();

        return res.status(201).send({
          error: null,
          data: fileMiningTask
        });
      } catch (err) {
        return next(err);
      }
    },

    async startMiningPST(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;

      const {
        name,
        extractSignatures,
        cleaningEnabled
      }: {
        name: string;
        extractSignatures: boolean;
        cleaningEnabled: boolean;
      } = req.body;

      const errors = [
        validateType('name', name, 'string'),
        validateType('extractSignatures', extractSignatures, 'boolean'),
        validateType('cleaningEnabled', cleaningEnabled, 'boolean')
      ].filter(Boolean);

      if (errors.length) {
        return res
          .status(400)
          .json({ message: `Invalid input: ${errors.join(', ')}` });
      }

      const effectiveCleaningEnabled =
        cleaningEnabled && hasEmailVerificationConfigured(ENV);

      try {
        const miningId = await deps.idGenerator();

        const pipeline = createPstMining(
          {
            miningId,
            userId: user.id,
            source: name,
            fetchEmailBody: extractSignatures,
            cleaningEnabled: effectiveCleaningEnabled,
            fetcherClient: deps.pstFetcherClient
          },
          deps.pipelineDeps
        );

        const miningTask = await miningEngine.submit(pipeline);

        const { userId } = miningTask;

        if (effectiveCleaningEnabled) {
          const cleanTask = pipeline.getTask<CleanTask>(TaskId.Clean);
          const emailStream = cleanTask?.streams?.input[0]?.streamName;

          if (emailStream) {
            const totalPublished =
              await publishPreviouslyUnverifiedEmailsToCleaning(
                contactsDB,
                userId,
                miningId,
                emailStream
              );
            const extractTask = pipeline.getTask<ExtractTask>(TaskId.Extract);
            if (extractTask) {
              extractTask.addCreatedContacts(totalPublished);
            }
          }
        }

        return res.status(201).send({ error: null, data: miningTask });
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.toLowerCase().startsWith('invalid credentials')
        ) {
          return res.status(401).json({ message: err.message });
        }
        if (
          err instanceof Error &&
          'textCode' in err &&
          err.textCode === 'CANNOT'
        ) {
          return res.sendStatus(409);
        }

        if (
          err instanceof Error &&
          err.message === 'Failed to parse PST file'
        ) {
          return res.status(422).json({ message: err.message });
        }

        return next(err);
      }
    },

    async stopMiningTask(req: Request, res: Response, next: NextFunction) {
      const { id: taskId } = req.params;
      const { user } = res.locals;

      const {
        processes,
        endEntireTask
      }: {
        processes: string[];
        endEntireTask: boolean;
      } = req.body;

      if (!endEntireTask && !Array.isArray(processes)) {
        return res.status(400).json({
          error: { message: 'processes should be an array of strings' }
        });
      }

      try {
        const pipeline = miningEngine.getPipeline(taskId);
        const task = pipeline.getActiveTask();

        if (user.id !== task.userId) {
          return res
            .status(401)
            .json({ error: { message: 'User not authorized.' } });
        }

        const deletedTask = await miningEngine.terminate(
          taskId,
          endEntireTask ? undefined : processes
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
          .schema('private')
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(20);

        if (error || !userActiveTasks || userActiveTasks.length === 0) {
          return res.status(204).send({ active: [], passive: [] });
        }

        const tasksByMiningId = (userActiveTasks as DBTask[]).reduce(
          (acc, task) => {
            const mId = task.details?.miningId;
            if (mId) {
              if (!acc[mId]) acc[mId] = [];
              acc[mId].push(task);
            }
            return acc;
          },
          {} as Record<string, DBTask[]>
        );

        const active: any[] = [];
        const passive: any[] = [];

        for (const [miningId, sessionTasks] of Object.entries(
          tasksByMiningId
        )) {
          const allTasksStopped = sessionTasks.every(
            (t) => t.stopped_at !== null
          );

          if (allTasksStopped) {
            try {
              const pipeline = miningEngine.getPipeline(miningId);
              if (pipeline) {
                logger.info(
                  `Cleaning up stale in-memory task for miningId=${miningId}`
                );
                // eslint-disable-next-line no-await-in-loop
                await miningEngine.terminate(miningId);
              }
            } catch {
              // Error thrown by getPipeline means task doesn't exists in memory
            }
            continue;
          }

          const extractTask = sessionTasks.find(
            (t) => t.type === TaskType.Extract
          );
          const fetchTask = sessionTasks.find((t) => t.type === TaskType.Fetch);
          const cleanTask = sessionTasks.find((t) => t.type === TaskType.Clean);
          const signatureTask = sessionTasks.find(
            (t) => t.type === TaskType.Enrich || t.type === TaskType.Signature
          );

          let task = null;
          try {
            task = miningEngine.getPipeline(miningId).getActiveTask();
          } catch {}

          if (!task) continue;

          if (user.id !== task.userId) {
            continue;
          }

          const mapState = (t: DBTask | null | undefined) =>
            t ? { status: t.status, started_at: t.started_at } : null;

          const group = {
            task,
            fetch: mapState(fetchTask),
            extract: mapState(extractTask),
            clean: mapState(cleanTask),
            signature: mapState(signatureTask ?? null)
          };

          const isPassive = sessionTasks.some(
            (t) => t.details?.passive_mining === true
          );
          if (isPassive) {
            passive.push(group);
          } else {
            active.push(group);
          }
        }

        if (active.length === 0 && passive.length === 0) {
          return res.status(204).send({ active: [], passive: [] });
        }

        return res.status(200).send({ active, passive });
      } catch (err) {
        res.status(204);
        return next(err);
      }
    }
  };
}
