import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import { MiningSources } from '../db/interfaces/MiningSources';
import ImapBoxesFetcher from '../services/imap/ImapBoxesFetcher';
import ImapConnectionProvider from '../services/imap/ImapConnectionProvider';
import { ImapAuthError } from '../utils/errors';
import hashEmail from '../utils/helpers/hashHelpers';
import logger from '../utils/logger';
import { generateErrorObjectFromImapError } from './imap.helpers';

export default function initializeImapController(
  miningSourceService: MiningSources
) {
  const sendOAuthReauth = (res: Response) =>
    res.status(401).send({
      data: { message: 'OAuth connection needs re-authentication' }
    });

  return {
    async getImapBoxes(req: Request, res: Response, next: NextFunction) {
      const { email } = req.body;

      let imapConnection: Awaited<
        ReturnType<typeof ImapConnectionProvider.getSingleConnection>
      > | null = null;
      let isOAuthCredentials = false;

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

        isOAuthCredentials = 'accessToken' in data;

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

        // OAuth source needs re-authentication (fetch-mining-source returned
        // OAUTH_NEEDS_REAUTH, or the access token was rejected at IMAP connect).
        if (
          isOAuthCredentials &&
          (error?.status === 401 ||
            error?.message?.includes('re-authentication'))
        ) {
          return sendOAuthReauth(res);
        }

        if ([502, 503].includes(error?.output?.payload?.statusCode)) {
          return res
            .status(error?.output?.payload?.statusCode)
            .send(error?.output?.payload?.error);
        }

        const generatedError = generateErrorObjectFromImapError(error);
        if (
          isOAuthCredentials &&
          generatedError instanceof ImapAuthError &&
          generatedError.status === 401
        ) {
          return sendOAuthReauth(res);
        }
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
