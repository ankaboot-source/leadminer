import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import ImapConnectionProvider from '../services/ImapConnectionProvider';
import { TasksManager } from '../services/tasks-manager/TasksManager';
import { generateErrorObjectFromImapError } from './helpers';

export default function initializeMiningController(tasksManager: TasksManager) {
  return {
    async startMining(req: Request, res: Response, next: NextFunction) {
      const { user } = res.locals;
      const { id: userid, email } = user;
      const {
        access_token: accessToken,
        host,
        password,
        port,
        boxes
      } = req.body;

      if (!user) {
        res.status(400);
        return next(new Error('user does not exists.'));
      }

      const imapConnectionProvider = accessToken
        ? new ImapConnectionProvider(email).withOauth(accessToken)
        : new ImapConnectionProvider(email).withPassword(host, password, port);

      let imapConnection = null;
      let miningTask = null;

      try {
        // Connect to validate connection before creating the pool.
        imapConnection = await imapConnectionProvider.acquireConnection();
        const batchSize = ENV.LEADMINER_FETCH_BATCH_SIZE;
        const imapEmailsFetcherOptions: any = {
          imapConnectionProvider,
          boxes,
          id: userid,
          email,
          batchSize
        };

        miningTask = await tasksManager.createTask(
          userid,
          imapEmailsFetcherOptions
        );
      } catch (err) {
        const newError = generateErrorObjectFromImapError(err);

        await imapConnectionProvider.releaseConnection(imapConnection);
        await imapConnectionProvider.cleanPool();
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
        const { task } = tasksManager.getActiveTask(taskId);

        if (user.id !== task.userId) {
          return res
            .status(401)
            .json({ error: { message: 'User not authorized.' } });
        }

        await tasksManager.deleteTask(taskId);
        return res.status(200).send({ data: task });
      } catch (err) {
        res.status(404);
        return next(err);
      }
    },

    getMiningTask(req: Request, res: Response, next: NextFunction) {
      const { user } = res.locals;

      if (!user) {
        res.status(404);
        return next(new Error('user does not exists.'));
      }

      const { id: taskId } = req.params;

      try {
        const { task } = tasksManager.getActiveTask(taskId);

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
