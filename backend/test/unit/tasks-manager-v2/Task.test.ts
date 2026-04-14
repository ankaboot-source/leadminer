import { describe, expect, it, jest } from '@jest/globals';

import { Task } from '../../../src/services/tasks-manager-v2/tasks/Task';
import { FetchTask } from '../../../src/services/tasks-manager-v2/tasks/FetchTask';
import { ExtractTask } from '../../../src/services/tasks-manager-v2/tasks/ExtractTask';
import { CleanTask } from '../../../src/services/tasks-manager-v2/tasks/CleanTask';
import { SignatureTask } from '../../../src/services/tasks-manager-v2/tasks/SignatureTask';
import type { FetcherClient } from '../../../src/services/tasks-manager-v2/tasks/FetchTask';
import {
  TaskType,
  TaskCategory,
  TaskStatus
} from '../../../src/services/tasks-manager-v2/types';

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

describe('Task', () => {
  it('should initialize with correct properties', () => {
    const task = new Task({
      id: 'test-task',
      type: TaskType.Extract,
      category: TaskCategory.Mining,
      miningId: 'test-mining-id',
      userId: 'test-user',
      streams: {}
    });

    expect(task.id).toBe('test-task');
    expect(task.type).toBe(TaskType.Extract);
    expect(task.category).toBe(TaskCategory.Mining);
    expect(task.status).toBe(TaskStatus.Running);
    expect(task.progress).toEqual({ total: 0, processed: 0 });
    expect(task.upstreamDone).toBe(false);
  });

  describe('isComplete', () => {
    it('should be incomplete when running with no upstream done', () => {
      const task = new Task({
        id: 'extract',
        type: TaskType.Extract,
        category: TaskCategory.Mining,
        miningId: 'test',
        userId: 'test-user',
        streams: {}
      });
      task.progress = { total: 100, processed: 50 };

      expect(task.isComplete()).toBe(false);
    });

    it('should be complete when status is Done', () => {
      const task = new Task({
        id: 'fetch',
        type: TaskType.Fetch,
        category: TaskCategory.Mining,
        miningId: 'test',
        userId: 'test-user',
        streams: {}
      });
      task.status = TaskStatus.Done;

      expect(task.isComplete()).toBe(true);
    });

    it('should be complete when status is Canceled', () => {
      const task = new Task({
        id: 'fetch',
        type: TaskType.Fetch,
        category: TaskCategory.Mining,
        miningId: 'test',
        userId: 'test-user',
        streams: {}
      });
      task.status = TaskStatus.Canceled;

      expect(task.isComplete()).toBe(true);
    });

    it('should be complete when upstreamDone and processed >= total', () => {
      const task = new Task({
        id: 'extract',
        type: TaskType.Extract,
        category: TaskCategory.Mining,
        miningId: 'test',
        userId: 'test-user',
        streams: {}
      });
      task.upstreamDone = true;
      task.progress = { total: 100, processed: 100 };

      expect(task.isComplete()).toBe(true);
    });

    it('should be incomplete when upstreamDone but processed < total', () => {
      const task = new Task({
        id: 'extract',
        type: TaskType.Extract,
        category: TaskCategory.Mining,
        miningId: 'test',
        userId: 'test-user',
        streams: {}
      });
      task.upstreamDone = true;
      task.progress = { total: 100, processed: 50 };

      expect(task.isComplete()).toBe(false);
    });

    it('should be complete when upstreamDone and total is 0 (nothing to process)', () => {
      const task = new Task({
        id: 'extract',
        type: TaskType.Extract,
        category: TaskCategory.Mining,
        miningId: 'test',
        userId: 'test-user',
        streams: {}
      });
      task.upstreamDone = true;
      task.progress = { total: 0, processed: 0 };

      expect(task.isComplete()).toBe(true);
    });
  });

  describe('stop', () => {
    it('should set stoppedAt and calculate duration', async () => {
      const task = new Task({
        id: 'test',
        type: TaskType.Extract,
        category: TaskCategory.Mining,
        miningId: 'test',
        userId: 'test-user',
        streams: {}
      });
      task.startedAt = new Date().toUTCString();

      await task.stop(false);

      expect(task.status).toBe(TaskStatus.Done);
      expect(task.stoppedAt).toBeDefined();
      expect(task.duration).toBeDefined();
      expect(task.duration).toBeGreaterThanOrEqual(0);
    });

    it('should set status to Canceled when canceled is true', async () => {
      const task = new Task({
        id: 'test',
        type: TaskType.Extract,
        category: TaskCategory.Mining,
        miningId: 'test',
        userId: 'test-user',
        streams: {}
      });
      task.startedAt = new Date().toUTCString();

      await task.stop(true);

      expect(task.status).toBe(TaskStatus.Canceled);
    });
  });

  describe('toDetails', () => {
    it('should include miningId, stream, progress, and config', () => {
      const task = new Task({
        id: 'clean',
        type: TaskType.Clean,
        category: TaskCategory.Cleaning,
        miningId: 'test-mining',
        userId: 'test-user',
        streams: { input: { streamName: 'emails_stream-test' } },
        config: { customField: 'value' }
      });
      task.progress = { total: 10, processed: 5 };

      const details = task.toDetails();
      expect(details.miningId).toBe('test-mining');
      expect(details.stream).toEqual({
        input: { streamName: 'emails_stream-test' }
      });
      expect(details.progress).toEqual({ total: 10, processed: 5 });
      expect((details as Record<string, unknown>).customField).toBe('value');
    });
  });
});

describe('CleanTask', () => {
  it('should track verifiedContacts via onMessage', () => {
    const clean = new CleanTask({
      miningId: 'test',
      userId: 'test-user',
      inputStream: {
        streamName: 'emails_stream-test',
        consumerGroup: 'cleaners'
      }
    });

    expect(clean.progress).toEqual({ total: 0, processed: 0 });

    clean.onMessage({
      miningId: 'test',
      progressType: 'verifiedContacts',
      count: 3
    });
    expect(clean.progress.processed).toBe(3);

    clean.onMessage({
      miningId: 'test',
      progressType: 'verifiedContacts',
      count: 5
    });
    expect(clean.progress.processed).toBe(8);
  });
});

describe('ExtractTask', () => {
  it('should track processed via extracted messages', () => {
    const extract = new ExtractTask({
      miningId: 'test',
      userId: 'test-user',
      inputStream: {
        streamName: 'messages_stream-test',
        consumerGroup: 'extractors'
      },
      outputStream: { streamName: 'emails_stream-test' }
    });

    expect(extract.id).toBe('extract');
    expect(extract.type).toBe(TaskType.Extract);

    extract.onMessage({
      miningId: 'test',
      progressType: 'extracted',
      count: 10
    });
    expect(extract.progress.processed).toBe(10);
  });

  it('should track createdContactCount via addCreatedContacts', () => {
    const extract = new ExtractTask({
      miningId: 'test',
      userId: 'test-user',
      inputStream: { streamName: 'in', consumerGroup: 'cg' },
      outputStream: { streamName: 'out' }
    });

    expect(extract.createdContactCount).toBe(0);

    extract.addCreatedContacts(5);
    expect(extract.createdContactCount).toBe(5);

    extract.addCreatedContacts(3);
    expect(extract.createdContactCount).toBe(8);
  });

  it('should track createdContactCount via createdContacts messages', () => {
    const extract = new ExtractTask({
      miningId: 'test',
      userId: 'test-user',
      inputStream: { streamName: 'in', consumerGroup: 'cg' },
      outputStream: { streamName: 'out' }
    });

    extract.onMessage({
      miningId: 'test',
      progressType: 'createdContacts',
      count: 5
    });
    expect(extract.createdContactCount).toBe(5);

    extract.onMessage({
      miningId: 'test',
      progressType: 'createdContacts',
      count: 3
    });
    expect(extract.createdContactCount).toBe(8);
  });
});

describe('SignatureTask', () => {
  it('should have correct type', () => {
    const sig = new SignatureTask({
      miningId: 'test',
      userId: 'test-user',
      streamName: 'email-signature'
    });

    expect(sig.type).toBe(TaskType.Enrich);
  });

  it('should track signatures via onMessage', () => {
    const sig = new SignatureTask({
      miningId: 'test',
      userId: 'test-user',
      streamName: 'email-signature'
    });

    sig.onMessage({ miningId: 'test', progressType: 'signatures', count: 5 });
    expect(sig.progress.processed).toBe(5);

    sig.onMessage({
      miningId: 'test',
      progressType: 'signatures',
      count: 3,
      isCompleted: true
    });
    expect(sig.progress.processed).toBe(8);
    expect(sig.status).toBe(TaskStatus.Done);
  });
  describe('getProgressMap', () => {
    it('should return empty object by default', () => {
      const task = new Task({
        id: 'test',
        type: TaskType.Extract,
        category: TaskCategory.Mining,
        miningId: 'test',
        userId: 'test-user',
        streams: {}
      });

      expect(task.getProgressMap()).toEqual({});
    });

    it('should return correct map for FetchTask', () => {
      const mockFetcher = {
        startFetch: jest.fn().mockResolvedValue({ data: { totalMessages: 0 } }),
        stopFetch: jest
          .fn<
            (opts: { miningId: string; canceled: boolean }) => Promise<void>
          >()
          .mockResolvedValue()
      } as unknown as FetcherClient;
      const fetch = new FetchTask({
        miningId: 'test',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });

      fetch.progress = { total: 100, processed: 42 };

      const map = fetch.getProgressMap();
      expect(map).toEqual({ fetched: 42, totalMessages: 100 });
    });

    it('should return correct map for ExtractTask', () => {
      const extract = new ExtractTask({
        miningId: 'test',
        userId: 'test-user',
        inputStream: { streamName: 'in', consumerGroup: 'cg' },
        outputStream: { streamName: 'out' }
      });

      extract.progress = { total: 0, processed: 30 };
      extract.addCreatedContacts(12);

      const map = extract.getProgressMap();
      expect(map).toEqual({ extracted: 30, createdContacts: 12 });
    });

    it('should return correct map for CleanTask', () => {
      const clean = new CleanTask({
        miningId: 'test',
        userId: 'test-user',
        inputStream: { streamName: 'in', consumerGroup: 'cg' }
      });

      clean.progress = { total: 20, processed: 10 };

      const map = clean.getProgressMap();
      expect(map).toEqual({ verifiedContacts: 10 });
    });

    it('should return correct map for SignatureTask', () => {
      const sig = new SignatureTask({
        miningId: 'test',
        userId: 'test-user',
        streamName: 'sig-stream'
      });

      sig.progress = { total: 0, processed: 5 };

      const map = sig.getProgressMap();
      expect(map).toEqual({ signatures: 5 });
    });

    it('should return zero values when progress is zero', () => {
      const mockFetcher = {
        startFetch: jest.fn().mockResolvedValue({ data: { totalMessages: 0 } }),
        stopFetch: jest
          .fn<
            (opts: { miningId: string; canceled: boolean }) => Promise<void>
          >()
          .mockResolvedValue()
      } as unknown as FetcherClient;
      const fetch = new FetchTask({
        miningId: 'test',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher
      });

      const map = fetch.getProgressMap();
      expect(map).toEqual({ fetched: 0, totalMessages: 0 });
    });
  });
});

describe('FetchTask', () => {
  it('should set upstreamDone to true', () => {
    const mockFetcher = {
      startFetch: jest.fn().mockResolvedValue({ data: { totalMessages: 0 } }),
      stopFetch: jest
        .fn<(opts: { miningId: string; canceled: boolean }) => Promise<void>>()
        .mockResolvedValue()
    } as unknown as FetcherClient;

    const fetch = new FetchTask({
      miningId: 'test',
      userId: 'test-user',
      outputStream: 'messages_stream-test',
      fetcherClient: mockFetcher
    });

    expect(fetch.upstreamDone).toBe(true);
    expect(fetch.id).toBe('fetch');
    expect(fetch.type).toBe(TaskType.Fetch);
  });

  it('should handle totalMessages and fetched messages', () => {
    const mockFetcher = {
      startFetch: jest.fn().mockResolvedValue({ data: { totalMessages: 0 } }),
      stopFetch: jest
        .fn<(opts: { miningId: string; canceled: boolean }) => Promise<void>>()
        .mockResolvedValue()
    } as unknown as FetcherClient;

    const fetch = new FetchTask({
      miningId: 'test',
      userId: 'test-user',
      outputStream: 'messages_stream-test',
      fetcherClient: mockFetcher
    });

    fetch.onMessage({
      miningId: 'test',
      progressType: 'totalMessages',
      count: 100
    });
    expect(fetch.progress.total).toBe(100);

    fetch.onMessage({ miningId: 'test', progressType: 'fetched', count: 50 });
    expect(fetch.progress.processed).toBe(50);

    fetch.onMessage({
      miningId: 'test',
      progressType: 'fetched',
      count: 50,
      isCompleted: true
    });
    expect(fetch.progress.processed).toBe(100);
    expect(fetch.status).toBe(TaskStatus.Done);
  });

  it('should handle cancellation', () => {
    const mockFetcher = {
      startFetch: jest.fn().mockResolvedValue({ data: { totalMessages: 0 } }),
      stopFetch: jest
        .fn<(opts: { miningId: string; canceled: boolean }) => Promise<void>>()
        .mockResolvedValue()
    } as unknown as FetcherClient;

    const fetch = new FetchTask({
      miningId: 'test',
      userId: 'test-user',
      outputStream: 'messages_stream-test',
      fetcherClient: mockFetcher
    });

    fetch.onMessage({
      miningId: 'test',
      progressType: 'fetched',
      count: 30,
      isCanceled: true
    });
    expect(fetch.status).toBe(TaskStatus.Canceled);
  });

  describe('with PST source', () => {
    it('should pass source in fetchParams to startFetch for PST mining', async () => {
      const mockFetcher = {
        startFetch: jest
          .fn<
            (opts: {
              miningId: string;
              contactStream: string;
              signatureStream?: string;
              extractSignatures?: boolean;
              userId: string;
              fetchParams?: Record<string, unknown>;
            }) => Promise<{ data: { totalMessages: number } }>
          >()
          .mockResolvedValue({
            data: { totalMessages: 50 }
          }),
        stopFetch: jest
          .fn<
            (opts: { miningId: string; canceled: boolean }) => Promise<void>
          >()
          .mockResolvedValue()
      } as unknown as FetcherClient;

      const fetchTask = new FetchTask({
        miningId: 'test-pst-mining',
        userId: 'test-user',
        outputStream: 'messages_stream-test',
        fetcherClient: mockFetcher,
        extractSignatures: true,
        signatureStream: 'signature_stream',
        fetchParams: { source: 'test-user/file.pst' }
      });

      const mockTasksResolver = {
        create: jest
          .fn()
          .mockResolvedValue({
            id: 'task-id',
            startedAt: new Date().toISOString()
          }),
        update: jest.fn().mockResolvedValue({})
      };

      await fetchTask.start(mockTasksResolver as any);

      expect(mockFetcher.startFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          miningId: 'test-pst-mining',
          fetchParams: { source: 'test-user/file.pst' }
        })
      );
      expect(fetchTask.progress.total).toBe(50);
    });
  });
});
