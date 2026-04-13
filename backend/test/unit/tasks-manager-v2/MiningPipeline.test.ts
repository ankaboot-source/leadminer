import { describe, expect, it, jest } from '@jest/globals';
import type { Redis } from 'ioredis';

import { Pipeline } from '../../../src/services/tasks-manager-v2/Pipeline';
import { Task } from '../../../src/services/tasks-manager-v2/tasks/Task';
import { FetchTask } from '../../../src/services/tasks-manager-v2/tasks/FetchTask';
import { ExtractTask } from '../../../src/services/tasks-manager-v2/tasks/ExtractTask';
import { CleanTask } from '../../../src/services/tasks-manager-v2/tasks/CleanTask';
import { SignatureTask } from '../../../src/services/tasks-manager-v2/tasks/SignatureTask';
import SSEBroadcasterFactory from '../../../src/services/factory/SSEBroadcasterFactory';
import type { FetcherClient } from '../../../src/services/tasks-manager-v2/tasks/FetchTask';
import {
  TaskStatus,
  TaskType,
  TaskCategory
} from '../../../src/services/tasks-manager-v2/types';
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

function makeMockSSEFactory() {
  const mockSSE = {
    subscribeSSE: jest.fn(),
    sendSSE: jest.fn(),
    stop: jest.fn()
  };
  const factory = {
    create: jest.fn().mockReturnValue(mockSSE)
  } as unknown as SSEBroadcasterFactory;
  return { factory, mockSSE };
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
      redisPublisher: { publish: jest.fn() } as unknown as Redis,
      sseBroadcasterFactory: factory
    }
  );
}

describe('Pipeline', () => {
  describe('getFlattenedProgress', () => {
    it('should merge all task progress maps', () => {
      const { factory } = makeMockSSEFactory();

      const mockFetcher = {
        startFetch: jest.fn().mockResolvedValue({ data: { totalMessages: 0 } }),
        stopFetch: jest.fn().mockResolvedValue(undefined)
      } as unknown as FetcherClient;

      const fetch = new FetchTask({
        miningId: 'test',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });
      fetch.progress = { total: 100, processed: 50 };

      const extract = new ExtractTask({
        miningId: 'test',
        userId: 'test-user',
        inputStream: { streamName: 'in', consumerGroup: 'cg' },
        outputStream: { streamName: 'out' }
      });
      extract.progress = { total: 0, processed: 30 };
      extract.addCreatedContacts(12);

      const clean = new CleanTask({
        miningId: 'test',
        userId: 'test-user',
        inputStream: { streamName: 'in', consumerGroup: 'cg' }
      });
      clean.progress = { total: 20, processed: 10 };

      const sig = new SignatureTask({
        miningId: 'test',
        userId: 'test-user',
        streamName: 'sig-stream'
      });
      sig.progress = { total: 0, processed: 5 };

      const pipeline = makePipeline([fetch, extract, clean, sig], factory);

      const progress = pipeline.getFlattenedProgress();

      expect(progress.fetched).toBe(50);
      expect(progress.totalMessages).toBe(100);
      expect(progress.extracted).toBe(30);
      expect(progress.createdContacts).toBe(12);
      expect(progress.verifiedContacts).toBe(10);
      expect(progress.signatures).toBe(5);
    });

    it('should return empty when no tasks', () => {
      const { factory } = makeMockSSEFactory();
      const pipeline = makePipeline([], factory);

      const progress = pipeline.getFlattenedProgress();

      expect(progress).toEqual({});
    });

    it('should return zero for tasks with no progress', () => {
      const { factory } = makeMockSSEFactory();
      const mockFetcher = {
        startFetch: jest.fn().mockResolvedValue({ data: { totalMessages: 0 } }),
        stopFetch: jest.fn().mockResolvedValue(undefined)
      } as unknown as FetcherClient;

      const fetch = new FetchTask({
        miningId: 'test',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });

      const pipeline = makePipeline([fetch], factory);
      const progress = pipeline.getFlattenedProgress();

      expect(progress.fetched).toBe(0);
      expect(progress.totalMessages).toBe(0);
    });

    it('should work with single task', () => {
      const { factory } = makeMockSSEFactory();
      const mockFetcher = {
        startFetch: jest.fn().mockResolvedValue({ data: { totalMessages: 0 } }),
        stopFetch: jest.fn().mockResolvedValue(undefined)
      } as unknown as FetcherClient;

      const fetch = new FetchTask({
        miningId: 'test',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });
      fetch.progress = { total: 200, processed: 100 };

      const pipeline = makePipeline([fetch], factory);
      const progress = pipeline.getFlattenedProgress();

      expect(progress.fetched).toBe(100);
      expect(progress.totalMessages).toBe(200);
    });
  });

  describe('propagateProgress', () => {
    it('should propagate upstream processed as downstream total by default', () => {
      const { factory } = makeMockSSEFactory();
      const mockFetcher = {
        startFetch: jest.fn().mockResolvedValue({ data: { totalMessages: 0 } }),
        stopFetch: jest.fn().mockResolvedValue(undefined)
      } as unknown as FetcherClient;

      const fetch = new FetchTask({
        miningId: 'test',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });
      fetch.progress = { total: 100, processed: 100 };
      fetch.status = TaskStatus.Done;

      const extract = new ExtractTask({
        miningId: 'test',
        userId: 'test-user',
        inputStream: { streamName: 'in', consumerGroup: 'cg' },
        outputStream: { streamName: 'out' }
      });

      const pipeline = makePipeline([fetch, extract], factory);
      pipeline.addProgressLink('extract', 'fetch');

      (
        pipeline as unknown as { propagateProgress: () => void }
      ).propagateProgress();

      expect(extract.upstreamDone).toBe(true);
      expect(extract.progress.total).toBe(100);
    });

    it('should use totalFrom to set downstream total from a specific progress key', () => {
      const { factory } = makeMockSSEFactory();

      const extract = new ExtractTask({
        miningId: 'test',
        userId: 'test-user',
        inputStream: { streamName: 'in', consumerGroup: 'cg' },
        outputStream: { streamName: 'out' }
      });
      extract.progress = { total: 50, processed: 50 };
      extract.addCreatedContacts(30);
      extract.status = TaskStatus.Done;

      const clean = new CleanTask({
        miningId: 'test',
        userId: 'test-user',
        inputStream: { streamName: 'clean-in', consumerGroup: 'cg' }
      });

      const pipeline = makePipeline([extract, clean], factory);
      pipeline.addProgressLink('clean', 'extract', {
        totalFrom: 'createdContacts'
      });

      (
        pipeline as unknown as { propagateProgress: () => void }
      ).propagateProgress();

      expect(clean.upstreamDone).toBe(true);
      expect(clean.progress.total).toBe(30);
    });

    it('should not propagate total when skipTotal is true', () => {
      const { factory } = makeMockSSEFactory();
      const mockFetcher = {
        startFetch: jest.fn().mockResolvedValue({ data: { totalMessages: 0 } }),
        stopFetch: jest.fn().mockResolvedValue(undefined)
      } as unknown as FetcherClient;

      const fetch = new FetchTask({
        miningId: 'test',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });
      fetch.progress = { total: 200, processed: 200 };
      fetch.status = TaskStatus.Done;

      const sig = new SignatureTask({
        miningId: 'test',
        userId: 'test-user',
        streamName: 'sig-stream'
      });

      const pipeline = makePipeline([fetch, sig], factory);
      pipeline.addProgressLink('signature', 'fetch', { skipTotal: true });

      (
        pipeline as unknown as { propagateProgress: () => void }
      ).propagateProgress();

      expect(sig.upstreamDone).toBe(true);
      expect(sig.progress.total).toBe(0);
    });

    it('should not propagate until all upstreams are complete', () => {
      const { factory } = makeMockSSEFactory();
      const mockFetcher = {
        startFetch: jest.fn().mockResolvedValue({ data: { totalMessages: 0 } }),
        stopFetch: jest.fn().mockResolvedValue(undefined)
      } as unknown as FetcherClient;

      const fetch = new FetchTask({
        miningId: 'test',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });
      fetch.progress = { total: 100, processed: 50 };

      const extract = new ExtractTask({
        miningId: 'test',
        userId: 'test-user',
        inputStream: { streamName: 'in', consumerGroup: 'cg' },
        outputStream: { streamName: 'out' }
      });

      const pipeline = makePipeline([fetch, extract], factory);
      pipeline.addProgressLink('extract', 'fetch');

      (
        pipeline as unknown as { propagateProgress: () => void }
      ).propagateProgress();

      expect(extract.upstreamDone).toBe(false);
      expect(extract.progress.total).toBe(0);
    });

    it('should handle totalFrom when upstream key has zero value', () => {
      const { factory } = makeMockSSEFactory();

      const extract = new ExtractTask({
        miningId: 'test',
        userId: 'test-user',
        inputStream: { streamName: 'in', consumerGroup: 'cg' },
        outputStream: { streamName: 'out' }
      });
      extract.progress = { total: 0, processed: 0 };
      extract.status = TaskStatus.Done;

      const clean = new CleanTask({
        miningId: 'test',
        userId: 'test-user',
        inputStream: { streamName: 'clean-in', consumerGroup: 'cg' }
      });

      const pipeline = makePipeline([extract, clean], factory);
      pipeline.addProgressLink('clean', 'extract', {
        totalFrom: 'createdContacts'
      });

      (
        pipeline as unknown as { propagateProgress: () => void }
      ).propagateProgress();

      expect(clean.upstreamDone).toBe(true);
      expect(clean.progress.total).toBe(0);
    });
  });

  describe('broadcastTaskFinished', () => {
    it('should send task.processed value for finished event', () => {
      const { factory, mockSSE } = makeMockSSEFactory();
      const mockFetcher = {
        startFetch: jest.fn().mockResolvedValue({ data: { totalMessages: 0 } }),
        stopFetch: jest.fn().mockResolvedValue(undefined)
      } as unknown as FetcherClient;

      const fetch = new FetchTask({
        miningId: 'test-mining-id',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });
      fetch.progress = { total: 100, processed: 100 };

      const pipeline = makePipeline([fetch], factory);

      (
        pipeline as unknown as { broadcastTaskFinished: (task: Task) => void }
      ).broadcastTaskFinished(fetch);

      expect(mockSSE.sendSSE).toHaveBeenCalledWith(
        100,
        'fetch-finished-test-mining-id'
      );
    });

    it('should use task.progress.processed directly', () => {
      const { factory, mockSSE } = makeMockSSEFactory();
      const extract = new ExtractTask({
        miningId: 'test-mining-id',
        userId: 'test-user',
        inputStream: { streamName: 'in', consumerGroup: 'cg' },
        outputStream: { streamName: 'out' }
      });
      extract.progress = { total: 0, processed: 99 };

      const pipeline = makePipeline([extract], factory);

      (
        pipeline as unknown as { broadcastTaskFinished: (task: Task) => void }
      ).broadcastTaskFinished(extract);

      expect(mockSSE.sendSSE).toHaveBeenCalledWith(
        99,
        'extract-finished-test-mining-id'
      );
    });
  });

  describe('listenToTasks', () => {
    it('should broadcast progress events from tasks to SSE', () => {
      const { factory, mockSSE } = makeMockSSEFactory();

      const mockTask = new Task({
        id: 'mock-task',
        type: 'fetch' as TaskType,
        category: 'mining' as TaskCategory,
        miningId: 'test-mining-id',
        userId: 'test-user',
        streams: {}
      });

      makePipeline([mockTask], factory);

      (mockTask as unknown as Task).emit('progress', {
        key: 'test-event',
        value: 123
      });

      expect(mockSSE.sendSSE).toHaveBeenCalledWith(
        123,
        'test-event-test-mining-id'
      );
    });
  });
});
