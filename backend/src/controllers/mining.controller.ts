import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import { decode } from 'jsonwebtoken';
import ENV from '../config';
import { MiningSources } from '../db/interfaces/MiningSources';
import azureOAuth2Client from '../services/OAuth2/azure';
import googleOAuth2Client from '../services/OAuth2/google';
import ImapConnectionProvider from '../services/imap/ImapConnectionProvider';
import { ImapEmailsFetcherOptions } from '../services/imap/types';
import TasksManager from '../services/tasks-manager/TasksManager';
import { ImapAuthError } from '../utils/errors';
import { generateErrorObjectFromImapError, getValidImapLogin } from './helpers';

export default function initializeMiningController(
  tasksManager: TasksManager,
  miningSources: MiningSources
) {
  return {
    createGoogleMiningSource(_req: Request, res: Response) {
      const user = res.locals.user as User;
      const authorizationUri = googleOAuth2Client.authorizeURL({
        redirect_uri: `${ENV.LEADMINER_API_HOST}/api/imap/mine/sources/google/callback`,
        scope: [
          'openid',
          'https://mail.google.com/',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ],
        access_type: 'offline',
        prompt: 'consent',
        state: user.id // This will allow us in the callback to associate the authorized account with the user
      });

      return res.json({ authorizationUri });
    },

    async createGoogleMiningSourceCallback(req: Request, res: Response) {
      const { code, state } = req.query as { code: string; state: string };

      const tokenConfig = {
        code,
        redirect_uri: `${ENV.LEADMINER_API_HOST}/api/imap/mine/sources/google/callback`,
        scope: [
          'openid',
          'https://mail.google.com/',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ],
        access_type: 'offline',
        prompt: 'consent'
      };

      try {
        const { token } = await googleOAuth2Client.getToken(tokenConfig);

        const requiredScopes = [
          'openid',
          'https://mail.google.com/',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ];
        const approvedScopes = (token.scope as string).split(' ');

        const hasApprovedAllScopes = requiredScopes.every((scope) =>
          approvedScopes.includes(scope)
        );

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
              provider: 'google',
              expiresAt
            },
            type: 'google'
          });

          res.redirect(301, `${ENV.FRONTEND_HOST}/dashboard?source=${email}`);
        } else {
          // User has not approved all the required scopes
          res.redirect(
            301,
            `${ENV.FRONTEND_HOST}/oauth-consent-error?provider=google&referrer=${state}`
          );
        }
      } catch (error) {
        res.redirect(
          301,
          `${ENV.FRONTEND_HOST}/oauth-consent-error?provider=google&referrer=${state}`
        );
      }
    },

    createAzureMiningSource(_req: Request, res: Response) {
      const user = res.locals.user as User;

      const authorizationUri = azureOAuth2Client.authorizeURL({
        redirect_uri: `${ENV.LEADMINER_API_HOST}/api/imap/mine/sources/azure/callback`,
        scope: [
          'https://outlook.office.com/IMAP.AccessAsUser.All',
          'offline_access',
          'email',
          'openid',
          'profile'
        ],
        state: user.id
      });

      return res.json({ authorizationUri });
    },

    async createAzureMiningSourceCallback(req: Request, res: Response) {
      const { code, state } = req.query as { code: string; state: string };

      const tokenConfig = {
        code,
        redirect_uri: `${ENV.LEADMINER_API_HOST}/api/imap/mine/sources/azure/callback`,
        scope: [
          'https://outlook.office.com/IMAP.AccessAsUser.All',
          'offline_access',
          'email',
          'openid',
          'profile'
        ]
      };

      try {
        const { token } = await azureOAuth2Client.getToken(tokenConfig);

        const requiredScopes = [
          'https://outlook.office.com/IMAP.AccessAsUser.All'
        ];
        const approvedScopes = (token.scope as string).split(' ');

        const hasApprovedAllScopes = requiredScopes.every((scope) =>
          approvedScopes.includes(scope)
        );

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
              expiresAt,
              email,
              accessToken,
              refreshToken,
              provider: 'azure'
            },
            type: 'azure'
          });

          res.redirect(301, `${ENV.FRONTEND_HOST}/dashboard?source=${email}`);
        } else {
          // User has not approved all the required scopes
          res.redirect(
            301,
            `${ENV.FRONTEND_HOST}/oauth-consent-error?provider=azure&referrer=${state}`
          );
        }
      } catch (error) {
        res.redirect(
          301,
          `${ENV.FRONTEND_HOST}/oauth-consent-error?provider=azure&referrer=${state}`
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

      try {
        const task = tasksManager.getActiveTask(taskId);

        if (user.id !== task.userId) {
          return res
            .status(401)
            .json({ error: { message: 'User not authorized.' } });
        }

        const deletedTask = await tasksManager.deleteTask(taskId);
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
