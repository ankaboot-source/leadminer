import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import { decode } from 'jsonwebtoken';
import ENV from '../config';
import {
  MiningSources,
  OAuthMiningSourceProvider
} from '../db/interfaces/MiningSources';
import azureOAuth2Client from '../services/OAuth2/azure';
import googleOAuth2Client from '../services/OAuth2/google';
import ImapConnectionProvider from '../services/imap/ImapConnectionProvider';
import { ImapEmailsFetcherOptions } from '../services/imap/types';
import TasksManager from '../services/tasks-manager/TasksManager';
import { ImapAuthError } from '../utils/errors';
import { generateErrorObjectFromImapError, getValidImapLogin } from './helpers';

const providerScopes = {
  google: {
    scopes: [
      'openid',
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    requiredScopes: [
      'openid',
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ]
  },
  azure: {
    scopes: [
      'https://outlook.office.com/IMAP.AccessAsUser.All',
      'offline_access',
      'email',
      'openid',
      'profile'
    ],
    requiredScopes: ['https://outlook.office.com/IMAP.AccessAsUser.All']
  }
};

function getAuthClient(provider: OAuthMiningSourceProvider) {
  switch (provider) {
    case 'google':
      return googleOAuth2Client;
    case 'azure':
      return azureOAuth2Client;
    default:
      throw Error('Not a valid OAuth provider');
  }
}

function getTokenConfig(provider: OAuthMiningSourceProvider) {
  return {
    redirect_uri: `${ENV.LEADMINER_API_HOST}/api/imap/mine/sources/${provider}/callback`,
    scope: providerScopes[provider].scopes,
    access_type: provider === 'google' ? 'offline' : undefined,
    prompt: provider === 'google' ? 'consent' : undefined
  };
}

export default function initializeMiningController(
  tasksManager: TasksManager,
  miningSources: MiningSources
) {
  return {
    createProviderMiningSource(
      _req: Request,
      res: Response,
      provider: OAuthMiningSourceProvider
    ) {
      const user = res.locals.user as User;

      const authorizationUri = getAuthClient(provider).authorizeURL({
        ...getTokenConfig(provider),
        state: user.id // This will allow us in the callback to associate the authorized account with the user
      });

      return res.json({ authorizationUri });
    },

    async createProviderMiningSourceCallback(
      req: Request,
      res: Response,
      provider: OAuthMiningSourceProvider
    ) {
      const { code, state } = req.query as { code: string; state: string };

      const tokenConfig = {
        ...getTokenConfig(provider),
        code
      };

      try {
        const { token } = await getAuthClient(provider).getToken(tokenConfig);

        const approvedScopes = (token.scope as string).split(' ');

        const hasApprovedAllScopes = providerScopes[
          provider
        ].requiredScopes.every((scope) => approvedScopes.includes(scope));

        if (hasApprovedAllScopes) {
          // User has approved all the required scopes
          const {
            refresh_token: refreshToken,
            access_token: accessToken,
            id_token: idToken,
            expires_at: expiresAt
          } = token as {
            refresh_token: string;
            access_token: string;
            id_token: string;
            expires_at: number;
          };
          const { email } = decode(idToken) as { email: string };

          await miningSources.upsert({
            userId: state,
            email,
            credentials: {
              email,
              accessToken,
              refreshToken,
              provider,
              expiresAt
            },
            type: provider
          });

          res.redirect(301, `${ENV.FRONTEND_HOST}/dashboard?source=${email}`);
        } else {
          // User has not approved all the required scopes
          res.redirect(
            301,
            `${ENV.FRONTEND_HOST}/oauth-consent-error?provider=${provider}&referrer=${state}`
          );
        }
      } catch (error) {
        res.redirect(
          301,
          `${ENV.FRONTEND_HOST}/oauth-consent-error?provider=${provider}&referrer=${state}`
        );
      }
    },

    async createImapMiningSource(
      req: Request,
      res: Response,
      next: NextFunction
    ) {
      const user = res.locals.user as User;
      const { email, host, password, port, secure } = req.body;

      const missingParams = Object.entries({
        email,
        host,
        password,
        port,
        secure
      })
        .filter(([, value]) => value === undefined)
        .map(([key]) => key);

      if (missingParams.length) {
        res.status(400).json({
          message: `Missing required parameters ${missingParams.join(', ')}`
        });
      }

      try {
        // Validate & Get the valid IMAP login connection before creating the pool.
        const login = await getValidImapLogin(
          host,
          email,
          password,
          port,
          secure
        );
        await miningSources.upsert({
          userId: user.id,
          email,
          type: 'imap',
          credentials: { email: login, host, password, port, tls: secure }
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

      const { miningSource, boxes } = req.body;

      if (!miningSource || !boxes) {
        res.status(400).json({ message: 'Invalid mining source provided' });
      }

      const miningSourceCredentials =
        await miningSources.getCredentialsBySourceEmail(
          user.id,
          miningSource.email
        );

      if (!miningSourceCredentials) {
        return res.status(400).json({
          message: "This mining source isn't registered for this user"
        });
      }

      const imapConnectionProvider =
        'accessToken' in miningSourceCredentials
          ? new ImapConnectionProvider(miningSourceCredentials.email).withOauth(
              miningSourceCredentials.accessToken
            )
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
          boxes,
          userId: user.id,
          email: miningSourceCredentials.email,
          batchSize: ENV.LEADMINER_FETCH_BATCH_SIZE,
          fetchEmailBody: ENV.IMAP_FETCH_BODY
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

        const newError = generateErrorObjectFromImapError(err);

        res.status(500);
        return next(new Error(newError.message));
      }

      return res.status(201).send({ error: null, data: miningTask });
    },

    async stopMiningTask(req: Request, res: Response, next: NextFunction) {
      const { user } = res.locals;

      if (!user) {
        res.status(404);
        return next(new Error('user does not exists.'));
      }

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
        const task = tasksManager.getActiveTask(taskId);

        if (user.id !== task.userId) {
          return res
            .status(401)
            .json({ error: { message: 'User not authorized.' } });
        }

        const deletedTask = await tasksManager.deleteTask(
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

      const { id: taskId } = req.params;

      try {
        const task = tasksManager.getActiveTask(taskId);

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
