import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import {
  MiningSources,
  OAuthMiningSourceCredentials
} from '../db/interfaces/MiningSources';
import azureOAuth2Client from '../services/OAuth2/azure';
import googleOAuth2Client from '../services/OAuth2/google';
import ImapBoxesFetcher from '../services/imap/ImapBoxesFetcher';
import ImapConnectionProvider from '../services/imap/ImapConnectionProvider';
import { ImapAuthError } from '../utils/errors';
import hashEmail from '../utils/helpers/hashHelpers';
import validateType from '../utils/helpers/validation';
import logger from '../utils/logger';
import { generateErrorObjectFromImapError } from './imap.helpers';

function getTokenAndProvider(data: OAuthMiningSourceCredentials) {
  const { provider, accessToken, refreshToken, expiresAt } = data;
  const client = provider === 'azure' ? azureOAuth2Client : googleOAuth2Client;

  const token = client.createToken({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt
  });

  return { token, refreshToken, provider };
}

export default function initializeImapController(
  miningSourceService: MiningSources
) {
  return {
    async getImapBoxes(req: Request, res: Response, next: NextFunction) {
      const { email } = req.body;

      const errors = [validateType('email', email, 'string')].filter(Boolean);

      if (errors.length) {
        return res
          .status(400)
          .json({ message: `Invalid input: ${errors.join(', ')}` });
      }

      let imapConnection: Awaited<
        ReturnType<typeof ImapConnectionProvider.getSingleConnection>
      > | null = null;

      try {
        const userId = (res.locals.user as User).id;
        const sources = await miningSourceService.getSourcesForUser(
          userId,
          email
        );

        const data =
          sources?.find((e) => e.email === email)?.credentials ?? null;

        if (!data) {
          res.status(400);
          return next(
            new Error('Unable to retrieve credentials for this mining source')
          );
        }

        const isImapCredentials =
          'tls' in data && 'email' in data && 'password' in data;

        if (!('accessToken' in data) && !isImapCredentials) {
          return res.status(400).send({
            data: {
              message: 'This mining source does not support IMAP folders lookup'
            }
          });
        }

        if ('accessToken' in data) {
          const { token, refreshToken } = getTokenAndProvider(data);

          if (!refreshToken)
            return res.status(401).send({
              data: { message: 'No Refresh Token' }
            });

          if (token.expired(1000)) {
            return res.status(401).send({
              data: { message: 'Access token is expired' }
            });
          }
        }

        imapConnection = await ImapConnectionProvider.getSingleConnection(
          email,
          'accessToken' in data
            ? {
                oauthToken: data.accessToken
              }
            : {
                host: data.host,
                password: data.password,
                tls: data.tls,
                port: data.port
              }
        );

        const imapBoxesFetcher = new ImapBoxesFetcher(imapConnection, logger);
        const tree: any = await imapBoxesFetcher.getTree(email);

        logger.info('Mining IMAP tree succeeded.', {
          metadata: {
            user: hashEmail(email, userId)
          }
        });

        return res.status(200).send({
          data: { message: 'IMAP folders fetched successfully!', folders: tree }
        });
      } catch (error: any) {
        logger.error('Error during inbox fetch', {
          message: error.message,
          stack: error.stack,
          code: error.code
        });

        if ([502, 503].includes(error?.output?.payload?.statusCode)) {
          return res
            .status(error?.output?.payload?.statusCode)
            .send(error?.output?.payload?.error);
        }

        const generatedError = generateErrorObjectFromImapError(error);
        if (generatedError instanceof ImapAuthError) {
          return res.status(generatedError.status).send(generatedError);
        }
        return next(generatedError);
      } finally {
        if (imapConnection) {
          try {
            await imapConnection.logout();
          } catch (logoutError) {
            logger.warn(
              'Unable to close IMAP connection cleanly.',
              logoutError
            );
          }
        }
      }
    }
  };
}
