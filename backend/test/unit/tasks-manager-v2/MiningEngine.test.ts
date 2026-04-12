import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { MiningEngine } from '../../../src/services/tasks-manager-v2/MiningEngine';
import { TaskId } from '../../../src/services/tasks-manager-v2/types';
import type { ProgressMessage } from '../../../src/services/tasks-manager-v2/types';
import type { FetcherClient } from '../../../src/services/tasks-manager-v2/tasks/FetchTask';

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

function makeMockFetcher(): FetcherClient {
  return {
    startFetch: jest.fn().mockResolvedValue({
      data: { totalMessages: 100 }
    }),
    stopFetch: jest.fn().mockResolvedValue(undefined)
  };
}

function makeServiceDeps() {
  const mockSSE = makeMockSSE();
  let dbIdCounter = 0;

  const tasksResolver = {
    create: jest.fn().mockImplementation(() => {
      dbIdCounter += 1;
      return Promise.resolve({
        id: `task-db-id-${dbIdCounter}`,
        startedAt: new Date().toUTCString()
      });
    }),
    update: jest.fn().mockResolvedValue({
      id: 'task-db-id',
      startedAt: new Date().toUTCString()
    }),
    getById: jest.fn()
  };

  const redisSubscriber = {
    on: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  };

  const redisPublisher = {
    publish: jest.fn().mockResolvedValue(0),
    xgroup: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1)
  };

  const sseBroadcasterFactory = {
    create: jest.fn(() => mockSSE)
  };

  const idGenerator = jest.fn(() => Promise.resolve('test-mining-id'));

  const emailFetcherClient = makeMockFetcher();
  const pstFetcherClient = makeMockFetcher();

  return {
    tasksResolver,
    redisSubscriber,
    redisPublisher,
    sseBroadcasterFactory,
    idGenerator,
    emailFetcherClient,
    pstFetcherClient,
    mockSSE
  };
}

type ServiceDeps = ReturnType<typeof makeServiceDeps>;

function getMessageHandler(redisSubscriber: { on: jest.Mock }) {
  const messageCall = redisSubscriber.on.mock.calls.find(
    (call: unknown[]) => call[0] === 'message'
  );
  return messageCall?.[1] as
    | ((channel: string, data: string) => void)
    | undefined;
}

function msg(
  miningId: string,
  progressType: string,
  count: number,
  opts?: { isCompleted?: boolean; isCanceled?: boolean }
): ProgressMessage {
  return {
    miningId,
    progressType,
    count,
    ...opts
  };
}

describe('MiningEngine', () => {
  let deps: ServiceDeps;

  beforeEach(() => {
    deps = makeServiceDeps();
  });

  describe('Constructor', () => {
    it('should subscribe to Redis message events', () => {
      new MiningEngine(deps as any);

      expect(deps.redisSubscriber.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });
  });

  describe('createFileTask', () => {
    it('should create a file task and subscribe to Redis channel', async () => {
      const service = new MiningEngine(deps as any);

      const result = await service.createFileTask({
        userId: 'test-user-id',
        fileName: 'contacts.csv',
        totalImported: 100,
        cleaningEnabled: true
      });

      expect(deps.idGenerator).toHaveBeenCalled();
      expect(deps.redisSubscriber.subscribe).toHaveBeenCalledWith(
        'test-mining-id'
      );
      expect(result.miningId).toBe('test-mining-id');
      expect(result.miningSource.type).toBe('file');
    });

    it('should route messages to the correct manager via Redis handler', async () => {
      const service = new MiningEngine(deps as any);

      await service.createFileTask({
        userId: 'test-user-id',
        fileName: 'contacts.csv',
        totalImported: 100,
        cleaningEnabled: false
      });

      const messageHandler = getMessageHandler(deps.redisSubscriber);
      expect(messageHandler).toBeDefined();

      messageHandler!(
        'test-mining-id',
        JSON.stringify(msg('test-mining-id', 'extracted', 50))
      );

      const activeTask = service.getActiveTask('test-mining-id');
      expect(activeTask.progress.extracted).toBe(50);

      messageHandler!(
        'test-mining-id',
        JSON.stringify(msg('test-mining-id', 'createdContacts', 25))
      );

      const updatedTask = service.getActiveTask('test-mining-id');
      expect(updatedTask.progress.createdContacts).toBe(25);
    });

    it('should not route messages for unknown channels', async () => {
      const service = new MiningEngine(deps as any);

      await service.createFileTask({
        userId: 'test-user-id',
        fileName: 'contacts.csv',
        totalImported: 100,
        cleaningEnabled: false
      });

      const messageHandler = getMessageHandler(deps.redisSubscriber);

      messageHandler!(
        'unknown-mining-id',
        JSON.stringify(msg('unknown-mining-id', 'extracted', 50))
      );

      expect(() => service.getActiveTask('unknown-mining-id')).toThrow();
    });

    it('should route messages to correct manager when multiple exist', async () => {
      deps.idGenerator = jest
        .fn()
        .mockResolvedValueOnce('mining-1')
        .mockResolvedValueOnce('mining-2');

      const service = new MiningEngine(deps as any);

      await service.createFileTask({
        userId: 'test-user-id',
        fileName: 'file1.csv',
        totalImported: 100,
        cleaningEnabled: false
      });

      await service.createFileTask({
        userId: 'test-user-id',
        fileName: 'file2.csv',
        totalImported: 200,
        cleaningEnabled: false
      });

      const messageHandler = getMessageHandler(deps.redisSubscriber);

      messageHandler!(
        'mining-1',
        JSON.stringify(msg('mining-1', 'extracted', 10))
      );
      messageHandler!(
        'mining-2',
        JSON.stringify(msg('mining-2', 'extracted', 20))
      );

      expect(service.getActiveTask('mining-1').progress.extracted).toBe(10);
      expect(service.getActiveTask('mining-2').progress.extracted).toBe(20);
    });
  });

  describe('createImapTask', () => {
    it('should create an imap task and pass email fetcher client', async () => {
      const service = new MiningEngine(deps as any);

      const result = await service.createImapTask({
        userId: 'test-user-id',
        email: 'user@example.com',
        boxes: ['INBOX'],
        fetchEmailBody: false,
        cleaningEnabled: false
      });

      expect(deps.idGenerator).toHaveBeenCalled();
      expect(deps.emailFetcherClient.startFetch).toHaveBeenCalled();
      expect(deps.redisSubscriber.subscribe).toHaveBeenCalledWith(
        'test-mining-id'
      );
      expect(result.miningId).toBe('test-mining-id');
      expect(result.miningSource.type).toBe('email');
    });

    it('should route messages to imap manager', async () => {
      const service = new MiningEngine(deps as any);

      await service.createImapTask({
        userId: 'test-user-id',
        email: 'user@example.com',
        boxes: ['INBOX'],
        fetchEmailBody: false,
        cleaningEnabled: false
      });

      const messageHandler = getMessageHandler(deps.redisSubscriber);

      messageHandler!(
        'test-mining-id',
        JSON.stringify(msg('test-mining-id', 'totalMessages', 50))
      );
      messageHandler!(
        'test-mining-id',
        JSON.stringify(msg('test-mining-id', 'fetched', 25))
      );

      const activeTask = service.getActiveTask('test-mining-id');
      expect(activeTask.progress.totalMessages).toBe(50);
      expect(activeTask.progress.fetched).toBe(25);
    });

    it('should pass passiveMining flag when provided', async () => {
      const service = new MiningEngine(deps as any);

      const result = await service.createImapTask({
        userId: 'test-user-id',
        email: 'user@example.com',
        boxes: ['INBOX'],
        fetchEmailBody: false,
        cleaningEnabled: false,
        passiveMining: true
      });

      expect(result.miningId).toBe('test-mining-id');

      const manager = service.getPipeline('test-mining-id');
      expect(manager.passiveMining).toBe(true);
    });

    it('should default passiveMining to false when not provided', async () => {
      const service = new MiningEngine(deps as any);

      const result = await service.createImapTask({
        userId: 'test-user-id',
        email: 'user@example.com',
        boxes: ['INBOX'],
        fetchEmailBody: false,
        cleaningEnabled: false
      });

      const manager = service.getPipeline('test-mining-id');
      expect(manager.passiveMining).toBe(false);
    });
  });

  describe('createPstTask', () => {
    it('should create a pst task and pass pst fetcher client', async () => {
      const service = new MiningEngine(deps as any);

      const result = await service.createPstTask({
        userId: 'test-user-id',
        source: '/data/archive.pst',
        fetchEmailBody: false,
        cleaningEnabled: false
      });

      expect(deps.idGenerator).toHaveBeenCalled();
      expect(deps.pstFetcherClient.startFetch).toHaveBeenCalled();
      expect(deps.redisSubscriber.subscribe).toHaveBeenCalledWith(
        'test-mining-id'
      );
      expect(result.miningId).toBe('test-mining-id');
      expect(result.miningSource.type).toBe('pst');
    });

    it('should route messages to pst manager', async () => {
      const service = new MiningEngine(deps as any);

      await service.createPstTask({
        userId: 'test-user-id',
        source: '/data/archive.pst',
        fetchEmailBody: false,
        cleaningEnabled: false
      });

      const messageHandler = getMessageHandler(deps.redisSubscriber);

      messageHandler!(
        'test-mining-id',
        JSON.stringify(msg('test-mining-id', 'totalMessages', 75))
      );
      messageHandler!(
        'test-mining-id',
        JSON.stringify(msg('test-mining-id', 'fetched', 30))
      );

      const activeTask = service.getActiveTask('test-mining-id');
      expect(activeTask.progress.totalMessages).toBe(75);
      expect(activeTask.progress.fetched).toBe(30);
    });
  });

  describe('getPipeline', () => {
    it('should throw for non-existent miningId', () => {
      const service = new MiningEngine(deps as any);

      expect(() => service.getPipeline('non-existent-id')).toThrow(
        'Task with mining ID non-existent-id does not exist.'
      );
    });

    it('should return the manager for a valid miningId', async () => {
      const service = new MiningEngine(deps as any);

      await service.createFileTask({
        userId: 'test-user-id',
        fileName: 'contacts.csv',
        totalImported: 100,
        cleaningEnabled: false
      });

      const manager = service.getPipeline('test-mining-id');
      expect(manager).toBeDefined();
      expect(manager.miningId).toBe('test-mining-id');
    });
  });

  describe('deleteTask', () => {
    it('should cancel the manager and remove it from the service', async () => {
      const service = new MiningEngine(deps as any);

      await service.createFileTask({
        userId: 'test-user-id',
        fileName: 'contacts.csv',
        totalImported: 100,
        cleaningEnabled: false
      });

      const result = await service.deleteTask('test-mining-id', null);

      expect(result.miningId).toBe('test-mining-id');

      expect(deps.redisSubscriber.unsubscribe).toHaveBeenCalledWith(
        'test-mining-id'
      );

      expect(() => service.getPipeline('test-mining-id')).toThrow();
    });
  });

  describe('Error handling', () => {
    it('should clean up manager and unsubscribe when startFetch fails', async () => {
      const failingFetcher: FetcherClient = {
        startFetch: jest
          .fn()
          .mockRejectedValue(new Error('Fetcher connection refused')),
        stopFetch: jest.fn().mockResolvedValue(undefined)
      };

      deps.emailFetcherClient = failingFetcher;

      const service = new MiningEngine(deps as any);

      await expect(
        service.createImapTask({
          userId: 'test-user-id',
          email: 'user@example.com',
          boxes: ['INBOX'],
          fetchEmailBody: false,
          cleaningEnabled: false
        })
      ).rejects.toThrow('Fetcher connection refused');

      expect(() => service.getPipeline('test-mining-id')).toThrow(
        'Task with mining ID test-mining-id does not exist.'
      );

      expect(deps.redisSubscriber.unsubscribe).toHaveBeenCalledWith(
        'test-mining-id'
      );
    });

    it('should still accept new tasks after a failed start', async () => {
      const failingFetcher: FetcherClient = {
        startFetch: jest.fn().mockRejectedValue(new Error('Fetcher down')),
        stopFetch: jest.fn().mockResolvedValue(undefined)
      };

      deps.emailFetcherClient = failingFetcher;

      const service = new MiningEngine(deps as any);

      await expect(
        service.createImapTask({
          userId: 'test-user-id',
          email: 'user@example.com',
          boxes: ['INBOX'],
          fetchEmailBody: false,
          cleaningEnabled: false
        })
      ).rejects.toThrow('Fetcher down');

      deps.idGenerator = jest.fn(() => Promise.resolve('test-mining-id-2'));
      deps.emailFetcherClient = makeMockFetcher();

      const result = await service.createFileTask({
        userId: 'test-user-id',
        fileName: 'contacts.csv',
        totalImported: 100,
        cleaningEnabled: false
      });

      expect(result.miningId).toBe('test-mining-id-2');
      expect(service.getPipeline('test-mining-id-2')).toBeDefined();
    });

    it('should continue processing messages after encountering malformed data', async () => {
      const service = new MiningEngine(deps as any);

      await service.createFileTask({
        userId: 'test-user-id',
        fileName: 'contacts.csv',
        totalImported: 100,
        cleaningEnabled: false
      });

      const messageHandler = getMessageHandler(deps.redisSubscriber);

      messageHandler!('test-mining-id', 'not valid json');

      messageHandler!(
        'test-mining-id',
        JSON.stringify(msg('test-mining-id', 'extracted', 25))
      );

      expect(service.getActiveTask('test-mining-id').progress.extracted).toBe(
        25
      );
    });

    it('should not crash message handler when onMessage throws', async () => {
      const service = new MiningEngine(deps as any);

      await service.createFileTask({
        userId: 'test-user-id',
        fileName: 'contacts.csv',
        totalImported: 100,
        cleaningEnabled: false
      });

      const messageHandler = getMessageHandler(deps.redisSubscriber);

      messageHandler!(
        'test-mining-id',
        JSON.stringify(msg('test-mining-id', 'extracted', 10))
      );
      expect(service.getActiveTask('test-mining-id').progress.extracted).toBe(
        10
      );

      messageHandler!(
        'unknown-channel',
        JSON.stringify(msg('unknown-id', 'extracted', 999))
      );

      messageHandler!(
        'test-mining-id',
        JSON.stringify(msg('test-mining-id', 'extracted', 15))
      );
      expect(service.getActiveTask('test-mining-id').progress.extracted).toBe(
        25
      );
    });
  });
});
