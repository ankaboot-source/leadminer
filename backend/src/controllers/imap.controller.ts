import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import Connection from 'imap';
import { MiningSources } from '../db/MiningSources';
import azureOAuth2Client from '../services/OAuth2/azure';
import googleOAuth2Client from '../services/OAuth2/google';
import ImapBoxesFetcher from '../services/imap/ImapBoxesFetcher';
import ImapConnectionProvider from '../services/imap/ImapConnectionProvider';
import { hashEmail } from '../utils/helpers/hashHelpers';
import logger from '../utils/logger';
import { generateErrorObjectFromImapError } from './helpers';

export default function initializeImapController(miningSources: MiningSources) {
  return {
    async getImapBoxes(req: Request, res: Response, next: NextFunction) {
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
          provider === 'Azure' ? azureOAuth2Client : googleOAuth2Client;

        const token = client.createToken({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt
        });

        if (token.expired(1000)) {
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

      const imapConnectionProvider =
        'accessToken' in data
          ? new ImapConnectionProvider(data.email).withOauth(data.accessToken)
          : new ImapConnectionProvider(data.email).withPassword(
              data.host,
              data.password,
              data.port
            );

      let imapConnection: Connection | null = null;

      try {
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
      } catch (err) {
        const generatedError = generateErrorObjectFromImapError(err);
        return next(generatedError);
      } finally {
        if (imapConnection) {
          await imapConnectionProvider.releaseConnection(imapConnection);
        }
        await imapConnectionProvider.cleanPool();
      }
    }
  };
}
