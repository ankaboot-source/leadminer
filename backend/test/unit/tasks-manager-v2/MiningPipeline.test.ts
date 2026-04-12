import { describe, expect, it, jest } from '@jest/globals';

import { Pipeline } from '../../../src/services/tasks-manager-v2/Pipeline';
import { Task } from '../../../src/services/tasks-manager-v2/tasks/Task';
import { FetchTask } from '../../../src/services/tasks-manager-v2/tasks/FetchTask';
import { ExtractTask } from '../../../src/services/tasks-manager-v2/tasks/ExtractTask';
import { CleanTask } from '../../../src/services/tasks-manager-v2/tasks/CleanTask';
import { SignatureTask } from '../../../src/services/tasks-manager-v2/tasks/SignatureTask';

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

function makeMockSSE() {
  return {
    subscribeSSE: jest.fn(),
    sendSSE: jest.fn(),
    stop: jest.fn()
  };
}

function makeMockSSEFactory() {
  const mockSSE = makeMockSSE();
  const factory = {
    create: jest.fn(() => mockSSE)
  };
  return { factory, mockSSE };
}

function makeManager(tasks: Task[], factory: { create: jest.Mock }) {
  return new Pipeline(
    {
      miningId: 'test-mining-id',
      userId: 'test-user-id',
      source: { type: 'email' as const, source: 'test@test.com' },
      tasks,
      onComplete: undefined
    },
    {
      tasksResolver: {} as any,
      redisPublisher: { publish: jest.fn() } as any,
      sseBroadcasterFactory: factory
    }
  );
}

describe('Pipeline', () => {
  describe('getFlattenedProgress', () => {
    it('should merge all task progress maps', () => {
      const { factory } = makeMockSSEFactory();

      const mockFetcher = { startFetch: jest.fn(), stopFetch: jest.fn() };

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

      const manager = makeManager([fetch, extract, clean, sig], factory);

      const progress = manager.getFlattenedProgress();

      expect(progress.fetched).toBe(50);
      expect(progress.totalMessages).toBe(100);
      expect(progress.extracted).toBe(30);
      expect(progress.createdContacts).toBe(12);
      expect(progress.verifiedContacts).toBe(10);
      expect(progress.signatures).toBe(5);
    });

    it('should return empty when no tasks', () => {
      const { factory } = makeMockSSEFactory();
      const manager = makeManager([], factory);

      const progress = manager.getFlattenedProgress();

      expect(progress).toEqual({});
    });

    it('should return zero for tasks with no progress', () => {
      const { factory } = makeMockSSEFactory();
      const mockFetcher = { startFetch: jest.fn(), stopFetch: jest.fn() };

      const fetch = new FetchTask({
        miningId: 'test',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });

      const manager = makeManager([fetch], factory);
      const progress = manager.getFlattenedProgress();

      expect(progress.fetched).toBe(0);
      expect(progress.totalMessages).toBe(0);
    });

    it('should work with single task', () => {
      const { factory } = makeMockSSEFactory();
      const mockFetcher = { startFetch: jest.fn(), stopFetch: jest.fn() };

      const fetch = new FetchTask({
        miningId: 'test',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });
      fetch.progress = { total: 200, processed: 100 };

      const manager = makeManager([fetch], factory);
      const progress = manager.getFlattenedProgress();

      expect(progress.fetched).toBe(100);
      expect(progress.totalMessages).toBe(200);
    });
  });

  describe('propagateProgress', () => {
    it('should propagate upstream processed as downstream total by default', () => {
      const { factory } = makeMockSSEFactory();
      const mockFetcher = { startFetch: jest.fn(), stopFetch: jest.fn() };

      const fetch = new FetchTask({
        miningId: 'test',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });
      fetch.progress = { total: 100, processed: 100 };
      fetch.status = 'done' as any;

      const extract = new ExtractTask({
        miningId: 'test',
        userId: 'test-user',
        inputStream: { streamName: 'in', consumerGroup: 'cg' },
        outputStream: { streamName: 'out' }
      });

      const manager = makeManager([fetch, extract], factory);
      manager.addProgressLink('extract', 'fetch');

      (manager as any).propagateProgress();

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
      extract.status = 'done' as any;

      const clean = new CleanTask({
        miningId: 'test',
        userId: 'test-user',
        inputStream: { streamName: 'clean-in', consumerGroup: 'cg' }
      });

      const manager = makeManager([extract, clean], factory);
      manager.addProgressLink('clean', 'extract', {
        totalFrom: 'createdContacts'
      });

      (manager as any).propagateProgress();

      expect(clean.upstreamDone).toBe(true);
      expect(clean.progress.total).toBe(30);
    });

    it('should not propagate total when skipTotal is true', () => {
      const { factory } = makeMockSSEFactory();
      const mockFetcher = { startFetch: jest.fn(), stopFetch: jest.fn() };

      const fetch = new FetchTask({
        miningId: 'test',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });
      fetch.progress = { total: 200, processed: 200 };
      fetch.status = 'done' as any;

      const sig = new SignatureTask({
        miningId: 'test',
        userId: 'test-user',
        streamName: 'sig-stream'
      });

      const manager = makeManager([fetch, sig], factory);
      manager.addProgressLink('signature', 'fetch', { skipTotal: true });

      (manager as any).propagateProgress();

      expect(sig.upstreamDone).toBe(true);
      expect(sig.progress.total).toBe(0);
    });

    it('should not propagate until all upstreams are complete', () => {
      const { factory } = makeMockSSEFactory();
      const mockFetcher = { startFetch: jest.fn(), stopFetch: jest.fn() };

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

      const manager = makeManager([fetch, extract], factory);
      manager.addProgressLink('extract', 'fetch');

      (manager as any).propagateProgress();

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
      extract.status = 'done' as any;

      const clean = new CleanTask({
        miningId: 'test',
        userId: 'test-user',
        inputStream: { streamName: 'clean-in', consumerGroup: 'cg' }
      });

      const manager = makeManager([extract, clean], factory);
      manager.addProgressLink('clean', 'extract', {
        totalFrom: 'createdContacts'
      });

      (manager as any).propagateProgress();

      expect(clean.upstreamDone).toBe(true);
      expect(clean.progress.total).toBe(0);
    });
  });

  describe('broadcastTaskFinished', () => {
    it('should send task.processed value for finished event', () => {
      const { factory, mockSSE } = makeMockSSEFactory();
      const mockFetcher = { startFetch: jest.fn(), stopFetch: jest.fn() };

      const fetch = new FetchTask({
        miningId: 'test-mining-id',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });
      fetch.progress = { total: 100, processed: 100 };

      const manager = makeManager([fetch], factory);

      (manager as any).broadcastTaskFinished(fetch);

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

      const manager = makeManager([extract], factory);

      (manager as any).broadcastTaskFinished(extract);

      expect(mockSSE.sendSSE).toHaveBeenCalledWith(
        99,
        'extract-finished-test-mining-id'
      );
    });
  });
});
