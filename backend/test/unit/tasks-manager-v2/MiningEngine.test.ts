import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { MiningEngine } from '../../../src/services/tasks-manager-v2/MiningEngine';
import { Pipeline } from '../../../src/services/tasks-manager-v2/Pipeline';

jest.mock('../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

function makeServiceDeps() {
  const redisSubscriber = {
    on: jest.fn(),
    off: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn().mockResolvedValue(undefined)
  };

  return {
    redisSubscriber
  };
}

describe('MiningEngine', () => {
  let deps: ReturnType<typeof makeServiceDeps>;
  let engine: MiningEngine;

  beforeEach(() => {
    deps = makeServiceDeps();
    engine = new MiningEngine(deps as any);
  });

  describe('Constructor', () => {
    it('should subscribe to Redis message events', () => {
      expect(deps.redisSubscriber.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });
  });

  describe('destroy', () => {
    it('should unsubscribe from Redis message events', () => {
      engine.destroy();
      expect(deps.redisSubscriber.off).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });
  });

  describe('submit', () => {
    it('should register a pipeline, start it, and return its active task', async () => {
      const mockActiveTask = { id: 'test-task', miningId: 'test-mining-id' };
      const pipeline = {
        miningId: 'test-mining-id',
        start: jest.fn().mockResolvedValue(undefined),
        getActiveTask: jest.fn().mockReturnValue(mockActiveTask),
        onComplete: undefined
      } as unknown as Pipeline;

      const result = await engine.submit(pipeline);

      expect(engine.getPipeline('test-mining-id')).toBe(pipeline);
      expect(deps.redisSubscriber.subscribe).toHaveBeenCalledWith(
        'test-mining-id'
      );
      expect(pipeline.start).toHaveBeenCalled();
      expect(result).toBe(mockActiveTask);
    });

    it('should remove the pipeline if start fails', async () => {
      const pipeline = {
        miningId: 'test-mining-id',
        start: jest.fn().mockRejectedValue(new Error('Start failed')),
        onComplete: undefined
      } as unknown as Pipeline;

      await expect(engine.submit(pipeline)).rejects.toThrow('Start failed');

      expect(() => engine.getPipeline('test-mining-id')).toThrow(
        'Task with mining ID test-mining-id does not exist.'
      );
      expect(deps.redisSubscriber.unsubscribe).toHaveBeenCalledWith(
        'test-mining-id'
      );
    });

    it('should remove the pipeline when onComplete is called', async () => {
      const pipeline = {
        miningId: 'test-mining-id',
        start: jest.fn().mockResolvedValue(undefined),
        getActiveTask: jest.fn(),
        onComplete: undefined
      } as any as Pipeline;

      await engine.submit(pipeline);

      expect(pipeline.onComplete).toBeDefined();

      // Simulate completion
      await pipeline.onComplete!();

      expect(() => engine.getPipeline('test-mining-id')).toThrow(
        'Task with mining ID test-mining-id does not exist.'
      );
      expect(deps.redisSubscriber.unsubscribe).toHaveBeenCalledWith(
        'test-mining-id'
      );
    });
  });

  describe('terminate', () => {
    it('should call cancel on the specified pipeline', async () => {
      const mockCanceledTask = { id: 'test-task', miningId: 'test-mining-id' };
      const pipeline = {
        miningId: 'test-mining-id',
        start: jest.fn().mockResolvedValue(undefined),
        getActiveTask: jest.fn(),
        cancel: jest.fn().mockResolvedValue(mockCanceledTask)
      } as unknown as Pipeline;

      await engine.submit(pipeline);

      const result = await engine.terminate('test-mining-id', ['process-1']);

      expect(pipeline.cancel).toHaveBeenCalledWith(['process-1']);
      expect(result).toBe(mockCanceledTask);
    });

    it('should throw if pipeline does not exist', async () => {
      await expect(engine.terminate('non-existent')).rejects.toThrow(
        'Task with mining ID non-existent does not exist.'
      );
    });
  });

  describe('Message Routing', () => {
    it('should route redis messages to the correct pipeline', async () => {
      const pipeline = {
        miningId: 'test-mining-id',
        start: jest.fn().mockResolvedValue(undefined),
        getActiveTask: jest.fn(),
        onMessage: jest.fn()
      } as unknown as Pipeline;

      await engine.submit(pipeline);

      const messageHandler = (
        deps.redisSubscriber.on as jest.Mock
      ).mock.calls.find((call: any) => call[0] === 'message')?.[1] as (
        channel: string,
        data: string
      ) => void;

      expect(messageHandler).toBeDefined();

      messageHandler('test-mining-id', 'test-data');

      expect(pipeline.onMessage).toHaveBeenCalledWith('test-data');
    });

    it('should handle onMessage throwing an error gracefully', async () => {
      const pipeline = {
        miningId: 'test-mining-id',
        start: jest.fn().mockResolvedValue(undefined),
        getActiveTask: jest.fn(),
        onMessage: jest.fn().mockImplementation(() => {
          throw new Error('Message error');
        })
      } as unknown as Pipeline;

      await engine.submit(pipeline);

      const messageHandler = (
        deps.redisSubscriber.on as jest.Mock
      ).mock.calls.find((call: any) => call[0] === 'message')?.[1] as (
        channel: string,
        data: string
      ) => void;

      // Should not throw
      expect(() => {
        messageHandler('test-mining-id', 'test-data');
      }).not.toThrow();
    });

    it('should ignore messages for unknown pipelines', () => {
      const messageHandler = (
        deps.redisSubscriber.on as jest.Mock
      ).mock.calls.find((call: any) => call[0] === 'message')?.[1] as (
        channel: string,
        data: string
      ) => void;

      // Should not throw
      expect(() => {
        messageHandler('unknown-mining-id', 'test-data');
      }).not.toThrow();
    });
  });
});
