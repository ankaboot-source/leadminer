import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import {
  MiningSources,
  OAuthMiningSourceCredentials,
  OAuthMiningSourceProvider
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

type NewToken = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

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

async function upsertMiningSource(
  miningSources: MiningSources,
  userId: string,
  token: NewToken,
  provider: OAuthMiningSourceProvider,
  email: string
) {
  await miningSources.upsert({
    type: provider,
    email,
    credentials: {
      email,
      provider,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_at
    },
    userId
  });
}
export default function initializeImapController(miningSources: MiningSources) {
  return {
    async getImapBoxes(req: Request, res: Response, next: NextFunction) {
      const { email } = req.body;

      const errors = [validateType('email', email, 'string')].filter(Boolean);

      if (errors.length) {
        return res
          .status(400)
          .json({ message: `Invalid input: ${errors.join(', ')}` });
      }

      try {
        const userId = (res.locals.user as User).id;
        const data = await miningSources.getCredentialsBySourceEmail(
          userId,
          email
        );

        if (!data) {
          res.status(400);
          return next(
            new Error('Unable to retrieve credentials for this mining source')
          );
        }
        if ('accessToken' in data) {
          const { token, refreshToken, provider } = getTokenAndProvider(data);
          if (!refreshToken)
            return res.status(401).send({
              data: { message: 'No Refresh Token' }
            });

          if (token.expired(1000)) {
            const newToken = (await token.refresh()).token as NewToken;

            await upsertMiningSource(
              miningSources,
              userId,
              newToken,
              provider,
              data.email
            );

            data.accessToken = newToken.access_token;
          }
        }

        const imapConnection = await ImapConnectionProvider.getSingleConnection(
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
        const tree: any = await imapBoxesFetcher.getTree(data.email);

        await imapConnection.logout();

        logger.info('Mining IMAP tree succeeded.', {
          metadata: {
            user: hashEmail(data.email, userId)
          }
        });

        return res.status(200).send({
          data: { message: 'IMAP folders fetched successfully!', folders: tree }
        });
      } catch (error: any) {
        logger.error("Error during inbox fetch", {
            message: error.message,
            stack: error.stack,
            code: error.code,
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
      }
    }
  };
}
