import { NextFunction, Request, Response } from 'express';
import { ImapUser, ImapUsers } from '../db/ImapUsers';
import { OAuthUser, OAuthUsers } from '../db/OAuthUsers';
import { ImapBoxesFetcher } from '../services/ImapBoxesFetcher';
import ImapConnectionProvider from '../services/ImapConnectionProvider';
import { hashEmail } from '../utils/helpers/hashHelpers';
import logger from '../utils/logger';
import redis from '../utils/redis';
import {
  generateErrorObjectFromImapError,
  getUser,
  getXImapHeaderField,
  validateAndExtractImapParametersFromBody,
  validateImapCredentials
} from './helpers';

const redisClient = redis.getClient();

export default function initializeImapController(
  oAuthUsers: OAuthUsers,
  imapUsers: ImapUsers
) {
  return {
    async loginToAccount(req: Request, res: Response, next: NextFunction) {
      try {
        const { email, host, tls, port, password } =
          validateAndExtractImapParametersFromBody(req.body);

        await validateImapCredentials(host, email, password, port);

        const user =
          (await getUser(
            { email, access_token: '', id: '' },
            imapUsers,
            oAuthUsers
          )) ?? (await imapUsers.create({ email, host, port, tls }));

        if (!user) {
          throw new Error(
            'Something went wrong on our end. Please try again later.'
          );
        }

        logger.info('IMAP login successful', { metadata: { email } });
        return res.status(200).send({ imap: user });
      } catch (err: any) {
        const errorResponse: any = new Error(err.message);
        errorResponse.errors = err.errors;
        res.status(err.errors ? 400 : 500);
        return next(errorResponse);
      }
    },
    async getImapBoxes(req: Request, res: Response, next: NextFunction) {
      const { data, error } = getXImapHeaderField(req.headers);

      if (error) {
        res.status(400);
        return next(error);
      }

      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { access_token, id, email, password } = data;
      const user = await getUser(data, imapUsers, oAuthUsers);

      if (user === null) {
        res.status(400);
        return next(new Error('user does not exists.'));
      }

      // eslint-disable-next-line @typescript-eslint/naming-convention
      const imapConnectionProvider = access_token
        ? await new ImapConnectionProvider(email).withGoogle(
            access_token,
            (user as OAuthUser).refresh_token,
            id,
            redisClient
          )
        : new ImapConnectionProvider(email).withPassword(
            (user as ImapUser).host,
            password,
            (user as ImapUser).port
          );

      let imapConnection = null;
      let tree = null;

      try {
        imapConnection = await imapConnectionProvider.acquireConnection();
        const imapBoxesFetcher = new ImapBoxesFetcher(imapConnectionProvider);
        tree = await imapBoxesFetcher.getTree();

        logger.info('Mining IMAP tree succeeded.', {
          metadata: {
            user: hashEmail(email, id)
          }
        });
      } catch (err) {
        const newError = generateErrorObjectFromImapError(err);

        res.status(newError.code);
        return next(new Error(newError.message));
      } finally {
        await imapConnectionProvider.releaseConnection(imapConnection);
        await imapConnectionProvider.cleanPool();
      }

      return res.status(200).send({
        message: 'IMAP folders fetched successfully!',
        imapFoldersTree: tree
      });
    }
  };
}
