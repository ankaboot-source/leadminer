import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import { decode } from 'jsonwebtoken';
import ENV from '../config';
import {
  MiningSources,
  OAuthMiningSourceProvider
} from '../db/interfaces/MiningSources';
import { ContactFormat } from '../services/extractors/engines/FileImport';
import ImapConnectionProvider from '../services/imap/ImapConnectionProvider';
import { ImapEmailsFetcherOptions } from '../services/imap/types';
import TaskManagerFile from '../services/tasks-manager/TaskManagerFile';
import TasksManager from '../services/tasks-manager/TasksManager';
import { ImapAuthError } from '../utils/errors';
import validateType from '../utils/helpers/validation';
import logger from '../utils/logger';
import redis from '../utils/redis';
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

export default function initializeMiningController(
  tasksManager: TasksManager,
  tasksManagerFile: TaskManagerFile,
  miningSources: MiningSources
) {
  return {
    async createProviderMiningSource(req: Request, res: Response) {
      const user = res.locals.user as User;
      const provider = req.params.provider as OAuthMiningSourceProvider;

      const authorizationUri = getAuthClient(provider).authorizeURL({
        ...getTokenConfig(provider),
        state: user.id // This will allow us in the callback to associate the authorized account with the user
      });

      return res.json({ authorizationUri });
    },

    async createProviderMiningSourceCallback(req: Request, res: Response) {
      const { code, state } = req.query as { code: string; state: string };
      const provider = req.params.provider as OAuthMiningSourceProvider;

      try {
        const exchangedTokens = await exchangeForToken(code, provider);

        await miningSources.upsert({
          userId: state,
          email: exchangedTokens.email,
          credentials: {
            ...exchangedTokens,
            provider
          },
          type: provider
        });
        res.redirect(
          301,
          `${ENV.FRONTEND_HOST}/mine?source=${exchangedTokens.email}`
        );
      } catch (error) {
        logger.error(error);
        res.redirect(
          301,
          `${ENV.FRONTEND_HOST}/callback?error=oauth-permissions&provider=${provider}&referrer=${state}&navigate_to=/mine`
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

    async getMiningSources(_req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;

      try {
        const sourcesData = await miningSources.getByUser(user.id);

        const sources = sourcesData.map((s) => ({
          email: s.email,
          type: s.type
        }));

        return res.status(200).send({
          message: 'Mining sources retrieved successfully',
          sources
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
        boxes: folders
      }: {
        miningSource: {
          email: string;
        };
        boxes: string[];
        extractSignatures: boolean;
      } = req.body;

      const errors = [
        validateType('email', email, 'string'),
        validateType('boxes', folders, 'string[]'),
        validateType('extractSignatures', extractSignatures, 'boolean')
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

      const miningSourceCredentials =
        await miningSources.getCredentialsBySourceEmail(
          user.id,
          sanitizedEmail
        );

      if (!miningSourceCredentials) {
        return res.status(401).json({
          message: "This mining source isn't registered for this user"
        });
      }

      const imapConnectionProvider =
        'accessToken' in miningSourceCredentials
          ? await new ImapConnectionProvider(
              miningSourceCredentials.email
            ).withOAuth(miningSourceCredentials, {
              miningSources,
              userId: user.id
            })
          : new ImapConnectionProvider(
              miningSourceCredentials.email
            ).withPassword(
              miningSourceCredentials.host,
              miningSourceCredentials.password,
              miningSourceCredentials.tls,
              miningSourceCredentials.port
            );

      let imapConnection = null;
      let miningTask = null;

      try {
        // Connect to validate connection before creating the pool.
        imapConnection = await imapConnectionProvider.acquireConnection();
        const imapEmailsFetcherOptions: ImapEmailsFetcherOptions = {
          imapConnectionProvider,
          boxes: sanitizedFolders,
          userId: user.id,
          email: miningSourceCredentials.email,
          batchSize: ENV.FETCHING_BATCH_SIZE_TO_SEND,
          fetchEmailBody: extractSignatures && ENV.IMAP_FETCH_BODY
        };
        miningTask = await tasksManager.createTask(imapEmailsFetcherOptions);
      } catch (err) {
        if (imapConnection) {
          await imapConnectionProvider.releaseConnection(imapConnection);
        }
        await imapConnectionProvider.cleanPool();

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

        const newError = generateErrorObjectFromImapError(err);

        res.status(500);
        return next(new Error(newError.message));
      }

      return res.status(201).send({ error: null, data: miningTask });
    },

    async startMiningFile(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;

      const {
        name,
        contacts
      }: {
        name: string;
        contacts: Partial<ContactFormat[]>;
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

        const fileMiningTask = await tasksManagerFile.createTask(user.id, 1);

        // Publish contacts to extracting redis stream
        await redis.getClient().xadd(
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
              contacts
            }
          })
        );

        return res.status(201).send({ error: null, data: fileMiningTask });
      } catch (err) {
        res.status(500);
        return next(err);
      }
    },

    async stopMiningTask(req: Request, res: Response, next: NextFunction) {
      const { type: miningType } = req.params;
      const { user } = res.locals;

      if (!user) {
        res.status(404);
        return next(new Error('user does not exists.'));
      }

      const manager = miningType === 'file' ? tasksManagerFile : tasksManager;

      const { id: taskId } = req.params;
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
        const task = manager.getActiveTask(taskId);

        if (user.id !== task.userId) {
          return res
            .status(401)
            .json({ error: { message: 'User not authorized.' } });
        }

        const deletedTask = await manager.deleteTask(
          taskId,
          endEntireTask ? null : processes
        );

        return res.status(200).json({ data: deletedTask });
      } catch (err) {
        res.status(404);
        return next(err);
      }
    },

    getMiningTask(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.User;

      const { id: taskId, type: miningType } = req.params;

      try {
        const task = (
          miningType === 'email' ? tasksManager : tasksManagerFile
        ).getActiveTask(taskId);

        if (user.id !== task.userId) {
          return res
            .status(401)
            .json({ error: { message: 'User not authorized.' } });
        }

        return res.status(200).send({ data: task });
      } catch (err) {
        res.status(404);
        return next(err);
      }
    }
  };
}
