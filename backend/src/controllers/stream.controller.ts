import { Request, Response } from 'express';
import { MiningEngine } from '../services/tasks-manager-v2/MiningEngine';
import logger from '../utils/logger';

export default function initializeStreamController(miningEngine: MiningEngine) {
  return {
    streamProgress: (req: Request, res: Response) => {
      const { id: taskId } = req.params;
      try {
        const pipeline = miningEngine.getPipeline(taskId);
        const task = pipeline.getActiveTask();

        if (res.locals.user.id !== task.userId) {
          res.status(401).json({ error: { message: 'User not authorized.' } });
          return;
        }

        logger.debug(`Attaching sse connection for taskId ${taskId}`);
        pipeline.attachSSE({ req, res });
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

      req.on('close', () => {
        logger.warn(`SSE Connection lost for mining task with id: ${taskId}`);
      });
    }
  };
}
