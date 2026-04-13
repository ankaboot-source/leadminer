import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import type { Redis } from 'ioredis';
import { MiningEngine } from '../../../src/services/tasks-manager-v2/MiningEngine';
import {
  createImapMining,
  createFileMining,
  createPstMining
} from '../../../src/services/tasks-manager-v2';
import type { PipelineDeps } from '../../../src/services/tasks-manager-v2/Pipeline';
import type { FetcherClient } from '../../../src/services/tasks-manager-v2/tasks/FetchTask';
import type { Tasks } from '../../../src/db/interfaces/Tasks';
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

jest.mock('../../../src/db/mail', () => ({
  refineContacts: jest.fn().mockResolvedValue(undefined as never),
  mailMiningComplete: jest.fn().mockResolvedValue(undefined as never)
}));

describe('Pipeline Integration', () => {
  let miningEngine: MiningEngine;
  let mockRedisSubscriber: Redis;
  let mockRedisPublisher: Redis;
  let mockSSE: { subscribeSSE: jest.Mock; sendSSE: jest.Mock; stop: jest.Mock };
  let mockSSEFactory: SSEBroadcasterFactory;
  let pipelineDeps: PipelineDeps;

  beforeEach(() => {
    mockRedisSubscriber = {
      on: jest.fn(),
      off: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    };
    mockRedisPublisher = {
      publish: jest.fn().mockResolvedValue(undefined as never),
      xgroup: jest.fn().mockResolvedValue('OK' as never),
      del: jest.fn().mockResolvedValue(1 as never)
    } as unknown as Redis;
    mockSSE = {
      subscribeSSE: jest.fn(),
      sendSSE: jest.fn(),
      stop: jest.fn()
    };
    mockSSEFactory = {
      create: jest.fn().mockReturnValue(mockSSE)
    };
    const mockTasksResolver = {
      create: jest.fn().mockResolvedValue({ id: 'db-task-id' } as never),
      update: jest.fn().mockResolvedValue(undefined as never)
    } as unknown as Tasks;
    pipelineDeps = {
      tasksResolver: mockTasksResolver as unknown as SupabaseTasks,
      redisPublisher: mockRedisPublisher as unknown as Redis,
      sseBroadcasterFactory: mockSSEFactory as unknown as SSEBroadcasterFactory
    };
    miningEngine = new MiningEngine({
      redisSubscriber: mockRedisSubscriber as unknown as Redis
    });
  });

  describe('IMAP mining scenario', () => {
    it('should create pipeline with fetch, extract, clean tasks and submit to engine', async () => {
      const mockFetcher = {
        startFetch: jest
          .fn()
          .mockResolvedValue({ data: { totalMessages: 100 } } as never),
        stopFetch: jest.fn<() => Promise<void>>().mockResolvedValue()
      } as unknown as FetcherClient;

      const pipeline = createImapMining(
        {
          miningId: 'test-imap-1',
          userId: 'user-1',
          email: 'test@example.com',
          boxes: ['INBOX'],
          fetchEmailBody: false,
          cleaningEnabled: true,
          fetcherClient: mockFetcher
        },
        pipelineDeps
      );

      const result = await miningEngine.submit(pipeline);

      expect(result.miningId).toBe('test-imap-1');
      expect(result.processes).toHaveProperty('fetch');
      expect(result.processes).toHaveProperty('extract');
      expect(result.processes).toHaveProperty('clean');
    });

    it('should broadcast progress events through SSE', async () => {
      const mockFetcher = {
        startFetch: jest
          .fn()
          .mockResolvedValue({ data: { totalMessages: 100 } } as never),
        stopFetch: jest.fn<() => Promise<void>>().mockResolvedValue()
      } as unknown as FetcherClient;

      const pipeline = createImapMining(
        {
          miningId: 'test-imap-2',
          userId: 'user-1',
          email: 'test@example.com',
          boxes: ['INBOX'],
          fetchEmailBody: false,
          cleaningEnabled: false,
          fetcherClient: mockFetcher
        },
        pipelineDeps
      );

      await miningEngine.submit(pipeline);

      const fetchTask = pipeline.getTask('fetch');
      fetchTask?.emit('progress', { key: 'fetched', value: 50 });

      expect(mockSSE.sendSSE).toHaveBeenCalledWith(50, 'fetched-test-imap-2');
    });

    it('should publish StreamCommand to Redis on pipeline start', async () => {
      const mockFetcher = {
        startFetch: jest
          .fn()
          .mockResolvedValue({ data: { totalMessages: 100 } } as never),
        stopFetch: jest.fn<() => Promise<void>>().mockResolvedValue()
      } as unknown as FetcherClient;

      const pipeline = createImapMining(
        {
          miningId: 'test-imap-3',
          userId: 'user-1',
          email: 'test@example.com',
          boxes: ['INBOX'],
          fetchEmailBody: false,
          cleaningEnabled: true,
          fetcherClient: mockFetcher
        },
        pipelineDeps
      );

      await miningEngine.submit(pipeline);

      expect(mockRedisPublisher.xgroup).toHaveBeenCalled();
      expect(mockRedisPublisher.publish).toHaveBeenCalledWith(
        'fake-pubsub-channel',
        expect.stringContaining('"command":"REGISTER"')
      );
    });

    it('should terminate pipeline when miningEngine.terminate is called', async () => {
      const mockFetcher = {
        startFetch: jest
          .fn()
          .mockResolvedValue({ data: { totalMessages: 100 } } as never),
        stopFetch: jest.fn<() => Promise<void>>().mockResolvedValue()
      } as unknown as FetcherClient;

      const pipeline = createImapMining(
        {
          miningId: 'test-imap-4',
          userId: 'user-1',
          email: 'test@example.com',
          boxes: ['INBOX'],
          fetchEmailBody: false,
          cleaningEnabled: false,
          fetcherClient: mockFetcher
        },
        pipelineDeps
      );

      await miningEngine.submit(pipeline);

      const result = await miningEngine.terminate('test-imap-4');

      expect(result.miningId).toBe('test-imap-4');
    });
  });

  describe('File mining scenario', () => {
    it('should create pipeline with extract task and set upstreamDone=true', () => {
      const pipeline = createFileMining(
        {
          miningId: 'test-file-1',
          userId: 'user-1',
          fileName: 'contacts.csv',
          totalImported: 500,
          cleaningEnabled: false
        },
        pipelineDeps
      );

      const extractTask = pipeline.getTask('extract');

      expect(extractTask?.upstreamDone).toBe(true);
      expect(extractTask?.progress.total).toBe(500);
    });
  });

  describe('PST mining scenario', () => {
    it('should create pipeline with fetch, extract, and signature tasks', () => {
      const mockPstFetcher = {
        startFetch: jest
          .fn()
          .mockResolvedValue({ data: { totalMessages: 200 } } as never),
        stopFetch: jest.fn<() => Promise<void>>().mockResolvedValue()
      } as unknown as FetcherClient;

      const pipeline = createPstMining(
        {
          miningId: 'test-pst-1',
          userId: 'user-1',
          source: 'file.pst',
          fetchEmailBody: true,
          cleaningEnabled: false,
          fetcherClient: mockPstFetcher
        },
        pipelineDeps
      );

      expect(pipeline.getTask('fetch')).toBeDefined();
      expect(pipeline.getTask('extract')).toBeDefined();
      expect(pipeline.getTask('signature')).toBeDefined();
    });
  });
});
