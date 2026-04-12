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
    },
    terminate: async (req: Request, res: Response) => {
      const { id: miningId } = req.params;
      const { processIds } = req.body;

      try {
        const activeTask = await miningEngine.terminate(miningId, processIds);
        res.status(200).json(activeTask);
      } catch (error) {
        logger.error(`Error terminating task ${miningId}`, { error });
        res.status(500).json({ error: { message: 'Failed to terminate task.' } });
      }
    }
        logger.debug(`Attaching sse connection for taskId ${taskId}`);
        pipeline.attachSSE({ req, res });
      } catch (error) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        res.write('event: error\n');
        res.write(`data: ${JSON.stringify(error)}\n\n`);
        res.end();
      }
    }
  };
}
