import { Request, Response } from 'express';
import TasksManager from '../services/tasks-manager/TasksManager';
import logger from '../utils/logger';

export default function initializeStreamController(tasksManager: TasksManager) {
  return {
    /**
     * Stream the progress of email extraction and scanning via Server-Sent Events (SSE).
     */
    streamProgress: (req: Request, res: Response) => {
      const { id: taskId } = req.params;

      try {
        // TODO: convert TaskManager to ts also add permission management.
        const task = tasksManager.getActiveTask(taskId);

        if (res.locals.user.id !== task.userId) {
          res.status(401).json({ error: { message: 'User not authorized.' } });
          return;
        }

        tasksManager.attachSSE(taskId, { req, res });
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
          await tasksManager.deleteTask(taskId, null);
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
