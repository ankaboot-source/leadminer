import { describe, expect, it, jest } from '@jest/globals';
import type { Redis } from 'ioredis';

import { Pipeline } from '../../../src/services/tasks-manager-v2/Pipeline';
import { Task } from '../../../src/services/tasks-manager-v2/tasks/Task';
import {
  TaskStatus,
  TaskType,
  TaskCategory
} from '../../../src/services/tasks-manager-v2/types';
import SSEBroadcasterFactory from '../../../src/services/factory/SSEBroadcasterFactory';
import SupabaseTasks from '../../../src/db/supabase/tasks';

jest.mock('../../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error',
  SUPABASE_PROJECT_URL: 'fake',
  SUPABASE_SECRET_PROJECT_TOKEN: 'fake',
  REDIS_EXTRACTING_STREAM_CONSUMER_GROUP: 'fake-group-extracting',
  REDIS_CLEANING_STREAM_CONSUMER_GROUP: 'fake-group-cleaning',
  REDIS_SIGNATURE_STREAM_NAME: 'signature-test-stream',
  REDIS_PUBSUB_COMMUNICATION_CHANNEL: 'fake-pubsub-channel',
  IMAP_FETCH_BODY: true
}));

jest.mock('../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../src/utils/supabase', () => ({
  default: {
    on: jest.fn(),
    subscribe: jest.fn(),
    publish: jest.fn(),
    xgroup: jest.fn(),
    del: jest.fn()
  }
}));

jest.mock('../../../src/db/mail', () => ({
  refineContacts: jest.fn(),
  mailMiningComplete: jest.fn()
}));

class MockTask extends Task {
  public startFn: jest.Mock;

  public stopFn: jest.Mock;

  constructor(id: string, startFn: jest.Mock, stopFn: jest.Mock) {
    super({
      id,
      type: TaskType.Fetch,
      category: TaskCategory.Mining,
      miningId: 'test-mining-id',
      userId: 'test-user-id'
    });
    this.startFn = startFn;
    this.stopFn = stopFn;
  }

  async start(...args: any[]) {
    await this.startFn(...args);
  }

  async stop(...args: any[]) {
    await this.stopFn(...args);
  }

  // eslint-disable-next-line class-methods-use-this
  onMessage() {}

  isComplete(): boolean {
    return this.status !== TaskStatus.Running;
  }

  // eslint-disable-next-line class-methods-use-this
  getProgressMap(): Record<string, number> {
    return {};
  }
}

function makeMockSSEFactory() {
  const mockSSE = {
    subscribeSSE: jest.fn(),
    sendSSE: jest.fn(),
    stop: jest.fn()
  };
  const mockRedisPublisher = {
    publish: jest.fn<() => Promise<number>>().mockResolvedValue(1),
    xgroup: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
    del: jest.fn<() => Promise<number>>().mockResolvedValue(1)
  } as unknown as Redis;
  const factory = {
    create: jest.fn().mockReturnValue(mockSSE)
  } as unknown as SSEBroadcasterFactory;
  return { factory, mockSSE, mockRedisPublisher };
}

function makePipeline(tasks: Task[], factory: SSEBroadcasterFactory) {
  return new Pipeline(
    {
      miningId: 'test-mining-id',
      userId: 'test-user-id',
      source: { type: 'email' as const, source: 'test@test.com' },
      tasks,
      onComplete: undefined
    },
    {
      tasksResolver: {} as unknown as SupabaseTasks,
      redisPublisher: {
        publish: jest.fn<() => Promise<number>>().mockResolvedValue(1),
        xgroup: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
        del: jest.fn<() => Promise<number>>().mockResolvedValue(1)
      } as unknown as Redis,
      sseBroadcasterFactory: factory
    }
  );
}

describe('PipelineSequential', () => {
  describe('start (sequential)', () => {
    it('should run tasks sequentially', async () => {
      const { factory } = makeMockSSEFactory();

      const start1 = jest.fn<() => Promise<void>>().mockResolvedValue();
      const stop1 = jest.fn<() => Promise<void>>().mockResolvedValue();
      const start2 = jest.fn<() => Promise<void>>().mockResolvedValue();
      const stop2 = jest.fn<() => Promise<void>>().mockResolvedValue();

      const task1 = new MockTask('task-1', start1, stop1);
      const task2 = new MockTask('task-2', start2, stop2);

      const pipeline = makePipeline([task1, task2], factory);

      await pipeline.start();

      expect(start1.mock.invocationCallOrder[0]).toBeLessThan(
        start2.mock.invocationCallOrder[0]
      );
    });

    it('should prevent second task from starting when first fails', async () => {
      const { factory } = makeMockSSEFactory();

      const start1 = jest
        .fn<() => Promise<void>>()
        .mockRejectedValue(new Error('Task 1 failed'));
      const stop1 = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
      const start2 = jest.fn<() => Promise<void>>();
      const stop2 = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

      const task1 = new MockTask('task-1', start1, stop1);
      const task2 = new MockTask('task-2', start2, stop2);

      const pipeline = makePipeline([task1, task2], factory);

      await expect(pipeline.start()).rejects.toThrow('Task 1 failed');

      expect(start2).not.toHaveBeenCalled();
    });

    it('should set failed flag and call cancel when a task fails', async () => {
      const { factory } = makeMockSSEFactory();

      const start1 = jest
        .fn<() => Promise<void>>()
        .mockRejectedValue(new Error('Task 1 failed'));
      const stop1 = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
      const start2 = jest.fn<() => Promise<void>>();
      const stop2 = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

      const task1 = new MockTask('task-1', start1, stop1);
      const task2 = new MockTask('task-2', start2, stop2);

      const pipeline = makePipeline([task1, task2], factory);

      await expect(pipeline.start()).rejects.toThrow('Task 1 failed');

      expect(pipeline.failed).toBe(true);
      expect(stop1).toHaveBeenCalled();
      expect(stop2).toHaveBeenCalled();
    });
  });
});
