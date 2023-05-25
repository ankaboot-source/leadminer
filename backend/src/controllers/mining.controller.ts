import { NextFunction, Request, Response } from 'express';
import { LEADMINER_FETCH_BATCH_SIZE } from '../config';
import { ImapUser, ImapUsers } from '../db/ImapUsers';
import { OAuthUser, OAuthUsers } from '../db/OAuthUsers';
import ImapConnectionProvider from '../services/ImapConnectionProvider';
import { TasksManager } from '../services/TasksManager';
import redis from '../utils/redis';
import {
  generateErrorObjectFromImapError,
  getUser,
  getXImapHeaderField
} from './helpers';

export default function initializeMiningController(
  oAuthUsers: OAuthUsers,
  imapUsers: ImapUsers,
  tasksManager: TasksManager
) {
  return {
    async startMining(req: Request, res: Response, next: NextFunction) {
      const { data, error } = getXImapHeaderField(req.headers);
      const { boxes } = req.body;

      if (error || boxes === undefined) {
        res.status(400);
        return next(error || new Error('Missing parameter boxes'));
      }

      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { access_token, id, email, password } = data;
      const user = await getUser(
        { access_token, id, email },
        imapUsers,
        oAuthUsers
      );

      if (user === null) {
        res.status(400);
        return next(new Error('user does not exists.'));
      }

      const imapConnectionProvider = access_token
        ? await new ImapConnectionProvider(email).withGoogle(
            access_token,
            (user as OAuthUser).refresh_token,
            id,
            redis.getClient()
          )
        : new ImapConnectionProvider(email).withPassword(
            (user as ImapUser).host,
            password,
            (user as ImapUser).port
          );

      let imapConnection = null;
      let miningTask = null;

      try {
        // Connect to validate connection before creating the pool.
        imapConnection = await imapConnectionProvider.acquireConnection();
        const batchSize = LEADMINER_FETCH_BATCH_SIZE;
        const imapEmailsFetcherOptions: any = {
          imapConnectionProvider,
          boxes,
          id,
          email,
          batchSize
        };

        miningTask = await tasksManager.createTask(
          id,
          imapEmailsFetcherOptions
        );
      } catch (err) {
        const newError = generateErrorObjectFromImapError(err);

        await imapConnectionProvider.releaseConnection(imapConnection);
        await imapConnectionProvider.cleanPool();
        res.status(newError.code);
        return next(new Error(newError.message));
      }

      return res.status(201).send({ error: null, data: miningTask });
    },

    async stopMiningTask(req: Request, res: Response, next: NextFunction) {
      const { error } = getXImapHeaderField(req.headers);

      if (error) {
        res.status(400);
        return next(error);
      }

      const { id } = req.params;

      try {
        const task = await tasksManager.deleteTask(id);
        return res.status(200).send({ data: task });
      } catch (err) {
        res.status(404);
        return next(err);
      }
    },

    getMiningTask(req: Request, res: Response, next: NextFunction) {
      const { error } = getXImapHeaderField(req.headers);

      if (error) {
        res.status(400);
        return next(error);
      }

      const { id } = req.params;

      try {
        const task = tasksManager.getActiveTask(id);
        return res.status(200).send({ data: task });
      } catch (err) {
        res.status(404);
        return next(err);
      }
    }
  };
}
