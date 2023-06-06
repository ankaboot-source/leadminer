import { NextFunction, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { ImapBoxesFetcher } from '../services/ImapBoxesFetcher';
import ImapConnectionProvider from '../services/ImapConnectionProvider';
import { hashEmail } from '../utils/helpers/hashHelpers';
import logger from '../utils/logger';
import {
  generateErrorObjectFromImapError,
  getXImapHeaderField,
  validateAndExtractImapParametersFromBody,
  validateImapCredentials
} from './helpers';

export default function initializeImapController(
  supabaseRestClient: SupabaseClient
) {
  return {
    async signinImap(req: Request, res: Response, next: NextFunction) {
      try {
        const { email, host, port, password } =
          validateAndExtractImapParametersFromBody(req.body);

        await validateImapCredentials(host, email, password, port);

        const response = await supabaseRestClient.auth.signInWithOtp({ email });

        if (response.error) {
          throw new Error(response.error.message);
        }

        const message = `Your IMAP sign-in was successful. We've sent a link to ${email}.`;
        logger.info('IMAP sign-in was successful', { metadata: { email } });

        return res.status(200).send({ data: { message } });
      } catch (err: any) {
        if (err.errors) {
          res.status(400);
          return next({ message: err.message, errors: err.errors });
        }

        res.status(500);
        return next(new Error(err.message));
      }
    },
    async getImapBoxes(req: Request, res: Response, next: NextFunction) {
      const { user } = res.locals;

      if (!user) {
        res.status(400);
        return next(new Error('user does not exists.'));
      }

      const { data, error } = getXImapHeaderField(req.headers);

      if (error) {
        res.status(400);
        return next(error);
      }

      const { id } = user;
      const { access_token: accessToken, email, host, password, port } = data;

      const imapConnectionProvider = accessToken
        ? new ImapConnectionProvider(user.email).withOauth(accessToken)
        : new ImapConnectionProvider(email).withPassword(host, password, port);

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
        const generatedError = generateErrorObjectFromImapError(err);
        const newError = {
          message: generatedError.message,
          errors: generatedError.errors
        };
        return next(newError);
      } finally {
        await imapConnectionProvider.releaseConnection(imapConnection);
        await imapConnectionProvider.cleanPool();
      }

      return res.status(200).send({
        data: { message: 'IMAP folders fetched successfully!', folders: tree }
      });
    }
  };
}
