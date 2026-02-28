import { Request, Response } from 'express';
import TasksManager from '../services/tasks-manager/TasksManager';
import TasksManagerFile from '../services/tasks-manager/TasksManagerFile';
import TasksManagerPST from '../services/tasks-manager/TasksManagerPST';
import logger from '../utils/logger';

export default function initializeStreamController(
  tasksManager: TasksManager,
  tasksManagerFile: TasksManagerFile,
  tasksManagerPST: TasksManagerPST
) {
  return {
    /**
     * Stream the progress of email extraction and scanning via Server-Sent Events (SSE).
     */
    streamProgress: (req: Request, res: Response) => {
      const { id: taskId, type: miningType } = req.params;

      let manager;
      if (miningType === 'file') {
        manager = tasksManagerFile;
      } else if (miningType === 'pst') {
        manager = tasksManagerPST;
      } else {
        manager = tasksManager;
      }

      try {
        const task = manager.getActiveTask(taskId);

        if (res.locals.user.id !== task.userId) {
          res.status(401).json({ error: { message: 'User not authorized.' } });
          return;
        }
        logger.debug(`Attaching sse connection for taskId ${taskId}`);
        manager.attachSSE(taskId, { req, res });
      } catch (error) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        res.status(404);
        res.write('id: 404-not-found\n');
        res.write('event: close\n');
        res.write(`data: ${JSON.stringify((error as Error).message)}\n\n`);
        res.flushHeaders();
        res.end();
      }

      req.on('close', async () => {
        logger.warn(`SSE Connection lost for mining task with id: ${taskId}`);
      });
    }
  };
}
