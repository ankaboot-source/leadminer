import { describe, expect, it, jest } from '@jest/globals';

import { GoogleContactsFetchTask } from '../../../src/services/tasks-manager-v2/tasks/GoogleContactsFetchTask';
import type { GoogleContactsFetcherClient } from '../../../src/services/tasks-manager-v2/tasks/GoogleContactsFetchTask';
import {
  TaskType,
  TaskCategory,
  TaskStatus
} from '../../../src/services/tasks-manager-v2/types';
import type { Task as DbTask } from '../../../src/db/types';
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

describe('GoogleContactsFetchTask', () => {
  it('should initialize with correct properties', () => {
    const mockFetcher = {
      startGoogleContactsSync: jest
        .fn<
          (opts: {
            miningId: string;
            contactStream: string;
            userId: string;
            userEmail: string;
            accessToken: string;
            refreshToken: string;
          }) => Promise<{ data: { totalContacts: number } }>
        >()
        .mockResolvedValue({ data: { totalContacts: 0 } }),
      stopGoogleContactsSync: jest
        .fn<(opts: { miningId: string; canceled: boolean }) => Promise<void>>()
        .mockResolvedValue()
    } as unknown as GoogleContactsFetcherClient;

    const task = new GoogleContactsFetchTask({
      miningId: 'test-mining-id',
      userId: 'test-user',
      userEmail: 'test@example.com',
      outputStream: 'contacts_stream-test',
      fetcherClient: mockFetcher,
      accessToken: 'test-value'
    });

    expect(task.id).toBe('google-contacts-fetch');
    expect(task.type).toBe(TaskType.GoogleContactsFetch);
    expect(task.category).toBe(TaskCategory.Mining);
    expect(task.status).toBe(TaskStatus.Running);
    expect(task.progress).toEqual({ total: 0, processed: 0 });
    expect(task.upstreamDone).toBe(true);
  });

  it('start() calls fetcherClient and sets total', async () => {
    const mockFetcher = {
      startGoogleContactsSync: jest
        .fn<
          (opts: {
            miningId: string;
            contactStream: string;
            userId: string;
            userEmail: string;
            accessToken: string;
            refreshToken: string;
          }) => Promise<{ data: { totalContacts: number } }>
        >()
        .mockResolvedValue({ data: { totalContacts: 42 } }),
      stopGoogleContactsSync: jest
        .fn<(opts: { miningId: string; canceled: boolean }) => Promise<void>>()
        .mockResolvedValue()
    } as unknown as GoogleContactsFetcherClient;

    const task = new GoogleContactsFetchTask({
      miningId: 'test-mining-id',
      userId: 'test-user',
      userEmail: 'test@example.com',
      outputStream: 'contacts_stream-test',
      fetcherClient: mockFetcher,
      accessToken: 'test-value'
    });

    const emitSpy = jest.spyOn(
      task as unknown as { emitProgress: (key: string, value: number) => void },
      'emitProgress'
    );

    const mockTasksResolver = {
      create: jest.fn<(task: DbTask) => Promise<DbTask>>().mockResolvedValue({
        id: 'task-id',
        userId: 'test-user',
        type: TaskType.GoogleContactsFetch,
        category: TaskCategory.Mining,
        status: TaskStatus.Running,
        details: {},
        startedAt: new Date().toISOString()
      }),
      update: jest.fn<(task: DbTask) => Promise<DbTask>>().mockResolvedValue({
        id: 'task-id',
        userId: 'test-user',
        type: TaskType.GoogleContactsFetch,
        category: TaskCategory.Mining,
        status: TaskStatus.Running,
        details: {}
      })
    };

    await task.start(mockTasksResolver as unknown as SupabaseTasks);

    expect(task.progress.total).toBe(42);
    expect(emitSpy).toHaveBeenCalledWith('totalMessages', 42);
  });

  it('start() handles 403 error', async () => {
    const mockFetcher = {
      startGoogleContactsSync: jest
        .fn<
          (opts: {
            miningId: string;
            contactStream: string;
            userId: string;
            userEmail: string;
            accessToken: string;
            refreshToken: string;
          }) => Promise<{ data: { totalContacts: number } }>
        >()
        .mockRejectedValue(new Error('403 Forbidden')),
      stopGoogleContactsSync: jest
        .fn<(opts: { miningId: string; canceled: boolean }) => Promise<void>>()
        .mockResolvedValue()
    } as unknown as GoogleContactsFetcherClient;

    const task = new GoogleContactsFetchTask({
      miningId: 'test-mining-id',
      userId: 'test-user',
      userEmail: 'test@example.com',
      outputStream: 'contacts_stream-test',
      fetcherClient: mockFetcher,
      accessToken: 'test-value'
    });

    const mockTasksResolver = {
      create: jest.fn<(task: DbTask) => Promise<DbTask>>().mockResolvedValue({
        id: 'task-id',
        userId: 'test-user',
        type: TaskType.GoogleContactsFetch,
        category: TaskCategory.Mining,
        status: TaskStatus.Running,
        details: {},
        startedAt: new Date().toISOString()
      }),
      update: jest.fn<(task: DbTask) => Promise<DbTask>>().mockResolvedValue({
        id: 'task-id',
        userId: 'test-user',
        type: TaskType.GoogleContactsFetch,
        category: TaskCategory.Mining,
        status: TaskStatus.Running,
        details: {}
      })
    };

    await expect(
      task.start(mockTasksResolver as unknown as SupabaseTasks)
    ).rejects.toThrow('403 Forbidden');

    expect(task.status).toBe(TaskStatus.Canceled);
    expect(task.stoppedAt).toBeDefined();
  });

  it('onMessage updates progress', () => {
    const mockFetcher = {
      startGoogleContactsSync: jest
        .fn<
          (opts: {
            miningId: string;
            contactStream: string;
            userId: string;
            userEmail: string;
            accessToken: string;
            refreshToken: string;
          }) => Promise<{ data: { totalContacts: number } }>
        >()
        .mockResolvedValue({ data: { totalContacts: 0 } }),
      stopGoogleContactsSync: jest
        .fn<(opts: { miningId: string; canceled: boolean }) => Promise<void>>()
        .mockResolvedValue()
    } as unknown as GoogleContactsFetcherClient;

    const task = new GoogleContactsFetchTask({
      miningId: 'test-mining-id',
      userId: 'test-user',
      userEmail: 'test@example.com',
      outputStream: 'contacts_stream-test',
      fetcherClient: mockFetcher,
      accessToken: 'test-value'
    });

    task.onMessage({
      miningId: 'test-mining-id',
      progressType: 'google-contacts-fetched',
      count: 10,
      isCompleted: false,
      isCanceled: false
    });
    expect(task.progress.processed).toBe(10);
    expect(task.status).toBe(TaskStatus.Running);

    task.onMessage({
      miningId: 'test-mining-id',
      progressType: 'google-contacts-fetched',
      count: 20,
      isCompleted: true,
      isCanceled: false
    });
    expect(task.progress.processed).toBe(20);
    expect(task.status).toBe(TaskStatus.Done);
  });

  it('onMessage handles cancel', () => {
    const mockFetcher = {
      startGoogleContactsSync: jest
        .fn<
          (opts: {
            miningId: string;
            contactStream: string;
            userId: string;
            userEmail: string;
            accessToken: string;
            refreshToken: string;
          }) => Promise<{ data: { totalContacts: number } }>
        >()
        .mockResolvedValue({ data: { totalContacts: 0 } }),
      stopGoogleContactsSync: jest
        .fn<(opts: { miningId: string; canceled: boolean }) => Promise<void>>()
        .mockResolvedValue()
    } as unknown as GoogleContactsFetcherClient;

    const task = new GoogleContactsFetchTask({
      miningId: 'test-mining-id',
      userId: 'test-user',
      userEmail: 'test@example.com',
      outputStream: 'contacts_stream-test',
      fetcherClient: mockFetcher,
      accessToken: 'test-value'
    });

    task.onMessage({
      miningId: 'test-mining-id',
      progressType: 'google-contacts-fetched',
      count: 5,
      isCompleted: false,
      isCanceled: true
    });
    expect(task.status).toBe(TaskStatus.Canceled);
  });

  describe('isComplete', () => {
    it('returns true when not running', () => {
      const mockFetcher = {
        startGoogleContactsSync: jest
          .fn<
            (opts: {
              miningId: string;
              contactStream: string;
              userId: string;
              userEmail: string;
              accessToken: string;
              refreshToken: string;
            }) => Promise<{ data: { totalContacts: number } }>
          >()
          .mockResolvedValue({ data: { totalContacts: 0 } }),
        stopGoogleContactsSync: jest
          .fn<
            (opts: { miningId: string; canceled: boolean }) => Promise<void>
          >()
          .mockResolvedValue()
      } as unknown as GoogleContactsFetcherClient;

      const task = new GoogleContactsFetchTask({
        miningId: 'test-mining-id',
        userId: 'test-user',
        userEmail: 'test@example.com',
        outputStream: 'contacts_stream-test',
        fetcherClient: mockFetcher,
        accessToken: 'test-value'
      });

      expect(task.status).toBe(TaskStatus.Running);
      expect(task.isComplete()).toBe(false);

      task.status = TaskStatus.Done;
      expect(task.isComplete()).toBe(true);

      task.status = TaskStatus.Canceled;
      expect(task.isComplete()).toBe(true);
    });
  });

  it('stop() calls fetcherClient stop', async () => {
    const mockFetcher = {
      startGoogleContactsSync: jest
        .fn<
          (opts: {
            miningId: string;
            contactStream: string;
            userId: string;
            userEmail: string;
            accessToken: string;
            refreshToken: string;
          }) => Promise<{ data: { totalContacts: number } }>
        >()
        .mockResolvedValue({ data: { totalContacts: 0 } }),
      stopGoogleContactsSync: jest
        .fn<(opts: { miningId: string; canceled: boolean }) => Promise<void>>()
        .mockResolvedValue()
    } as unknown as GoogleContactsFetcherClient;

    const task = new GoogleContactsFetchTask({
      miningId: 'test-mining-id',
      userId: 'test-user',
      userEmail: 'test@example.com',
      outputStream: 'contacts_stream-test',
      fetcherClient: mockFetcher,
      accessToken: 'test-value'
    });
    task.startedAt = new Date().toUTCString();

    await task.stop(true);

    expect(mockFetcher.stopGoogleContactsSync).toHaveBeenCalledWith({
      miningId: 'test-mining-id',
      canceled: true
    });
  });
});
