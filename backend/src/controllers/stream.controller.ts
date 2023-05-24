import { Request, Response } from 'express';
import { TasksManager } from '../services/TasksManager';
import logger from '../utils/logger';

export default function initializeStreamController(tasksManager: TasksManager) {
  return {
    /**
     * Stream the progress of email extraction and scanning via Server-Sent Events (SSE).
     */
    streamProgress: (req: Request, res: Response) => {
      const { id } = req.params;

      try {
        tasksManager.attachSSE(id, { req, res });
      } catch (error: any) {
        res.status(404);
        res.write('id: 0\n');
        res.write('event: close\n');
        res.write(`data: ${JSON.stringify(error.message)}\n\n`);
        res.flushHeaders();
        res.end();
      }

      req.on('close', async () => {
        try {
          await tasksManager.deleteTask(id);
        } catch (error) {
          logger.error(
            `Error when disconnecting from the stream with miningId ${id}`,
            error
          );
        }
      });
    }
  };
}
