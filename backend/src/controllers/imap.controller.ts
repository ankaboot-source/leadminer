import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import Connection from 'imap';
import IMAPSettingsDetector from '@ankaboot.io/imap-autoconfig';
import { MiningSources } from '../db/interfaces/MiningSources';
import azureOAuth2Client from '../services/OAuth2/azure';
import googleOAuth2Client from '../services/OAuth2/google';
import ImapBoxesFetcher from '../services/imap/ImapBoxesFetcher';
import ImapConnectionProvider from '../services/imap/ImapConnectionProvider';
import { ImapAuthError } from '../utils/errors';
import hashEmail from '../utils/helpers/hashHelpers';
import logger from '../utils/logger';
import { generateErrorObjectFromImapError } from './helpers';

export default function initializeImapController(miningSources: MiningSources) {
  return {
    async getImapBoxes(req: Request, res: Response, next: NextFunction) {
      let imapConnectionProvider: ImapConnectionProvider | null = null;
      let imapConnection: Connection | null = null;

      try {
        const { email } = req.body;
        const user = res.locals.user as User;

        const data = await miningSources.getCredentialsBySourceEmail(
          user.id,
          email
        );

        if (!data) {
          res.status(400);
          return next(
            new Error('Unable to retrieve credentials for this mining source')
          );
        }
        if ('accessToken' in data) {
          const { provider, accessToken, refreshToken, expiresAt } = data;
          const client =
            provider === 'azure' ? azureOAuth2Client : googleOAuth2Client;

          const token = client.createToken({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt
          });

          if (token.expired(1000)) {
            if (!refreshToken)
              return res.status(401).send({
                data: { message: 'Token has expired' }
              });
            const { token: newToken } = await token.refresh();
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const { access_token, refresh_token, expires_at } = newToken as {
              access_token: string;
              refresh_token: string;
              expires_at: number;
            };
            await miningSources.upsert({
              type: provider,
              email: data.email,
              credentials: {
                email: data.email,
                provider,
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: expires_at
              },
              userId: user.id
            });

            data.accessToken = access_token;
          }
        }

        imapConnectionProvider =
          'accessToken' in data
            ? new ImapConnectionProvider(data.email).withOauth(data.accessToken)
            : new ImapConnectionProvider(data.email).withPassword(
                data.host,
                data.password,
                data.tls,
                data.port
              );

        imapConnection = await imapConnectionProvider.acquireConnection();
        const imapBoxesFetcher = new ImapBoxesFetcher(imapConnectionProvider);
        const tree: any = await imapBoxesFetcher.getTree(data.email);

        logger.info('Mining IMAP tree succeeded.', {
          metadata: {
            user: hashEmail(data.email, user.id)
          }
        });

        return res.status(200).send({
          data: { message: 'IMAP folders fetched successfully!', folders: tree }
        });
      } catch (error: any) {
        if (
          error?.output?.payload?.statusCode === 502 ||
          error?.output?.payload?.statusCode === 503
        ) {
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
          await imapConnectionProvider?.releaseConnection(imapConnection);
        }
        await imapConnectionProvider?.cleanPool();
      }
    },

    async getImapConfigFromEmail(
      req: Request,
      res: Response,
      next: NextFunction
    ) {
      const { email } = req.params;

      if (!email) {
        return res
          .status(400)
          .json({ message: 'Missing required param email.' });
      }

      try {
        const config = await new IMAPSettingsDetector().detect(email);
        return config
          ? res.status(200).json({ ...config })
          : res.sendStatus(404);
      } catch (err) {
        return next(err);
      }
    }
  };
}
