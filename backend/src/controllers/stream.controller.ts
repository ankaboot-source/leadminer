import { Request, Response } from 'express';
import TasksManager from '../services/tasks-manager/TasksManager';
import logger from '../utils/logger';
import TasksManagerFile from '../services/tasks-manager/TaskManagerFile';

export default function initializeStreamController(
  tasksManager: TasksManager,
  tasksManagerFile: TasksManagerFile
) {
  return {
    /**
     * Stream the progress of email extraction and scanning via Server-Sent Events (SSE).
     */
    streamProgress: (req: Request, res: Response) => {
      const { id: taskId, type: miningType } = req.params;
      const manager = miningType === 'file' ? tasksManagerFile : tasksManager;

      try {
        const task = manager.getActiveTask(taskId);

        if (res.locals.user.id !== task.userId) {
          res.status(401).json({ error: { message: 'User not authorized.' } });
          return;
        }
        logger.debug(`Attaching sse connection for taskId ${taskId}`);
        manager.attachSSE(taskId, { req, res });
      } catch (error) {
        res.status(404);
        res.write('id: 0\n');
        res.write('event: close\n');
        res.write(`data: ${JSON.stringify((error as Error).message)}\n\n`);
        res.flushHeaders();
        res.end();
      }

      req.on('close', async () => {
        try {
          logger.debug(
            `Closing sse connection and deleting task for taskId ${taskId}`
          );
          await manager.deleteTask(taskId, null);
        } catch (error) {
          logger.error(
            `Error when disconnecting from the stream with miningId ${taskId}`,
            error
          );
        }
      });
    }
  };
}
