import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals';
import httpMocks from 'node-mocks-http';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'winston';
import EmailFetcherFactory from '../../src/services/factory/EmailFetcherFactory';
import SSEBroadcasterFactory from '../../src/services/factory/SSEBroadcasterFactory';
import TasksManager from '../../src/services/tasks-manager/TasksManager';
import {
  MiningTask,
  RedactedTask,
  TaskCategory,
  TaskExtract,
  TaskFetch,
  TaskStatus,
  TaskVerify
} from '../../src/services/tasks-manager/types';
import {
  flickrBase58IdGenerator,
  redactSensitiveData
} from '../../src/services/tasks-manager/utils';
import RealtimeSSE from '../../src/utils/helpers/sseHelpers';
import SupabaseTasks from '../../src/db/supabase/tasks';
import { ImapEmailsFetcherOptions } from '../../src/services/imap/types';
import ImapConnectionProvider from '../../src/services/imap/ImapConnectionProvider';
import redis from '../../src/utils/redis';
import {
  EMAILS_STREAM_CONSUMER_GROUP,
  MESSAGES_STREAM_CONSUMER_GROUP
} from '../../src/utils/constants';

jest.mock('../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error',
  SUPABASE_PROJECT_URL: 'fake',
  SUPABASE_SECRET_PROJECT_TOKEN: 'fake'
}));

jest.mock('../../src/utils/redis', () => {
  /**
   * Note: In the future, consider simplifying this by using "ioredis-mock" once it supports mocking 'xgroup' commands.
   * https://github.com/stipsan/ioredis-mock/blob/main/compat.md#supported-commands-
   */
  const clientMock = {
    on: jest.fn(),
    subscribe: jest.fn(),
    publish: jest.fn(),
    xgroup: jest.fn(),
    del: jest.fn()
  };

  return {
    getClient: jest.fn(() => clientMock),
    getSubscriberClient: jest.fn(() => clientMock)
  };
});

jest.mock('../../src/db/supabase/tasks', () =>
  jest.fn().mockImplementation(() => ({
    create: jest.fn(() => undefined),
    update: jest.fn(() => undefined)
  }))
);

const fakeRedisClient = redis.getClient();
const tasksResolver = new SupabaseTasks({} as SupabaseClient, {} as Logger);

const mockEmailFetcher = {
  getTotalMessages: jest.fn(() => 1000),
  start: jest.fn(),
  stop: jest.fn()
};
const mockedProgressHandler = {
  send: jest.fn(),
  stop: jest.fn()
};
const emailFetcherFactory = {
  create: jest.fn(() => mockEmailFetcher)
};

const sseBroadcasterFactory = {
  create: jest.fn(() => mockedProgressHandler)
};

const miningIdGenerator = jest.fn(async () =>
  Promise.resolve(`test-id-${Math.random().toString(36).substring(2)}`)
);

/*

TODO: 
    - [x] Mock redis and Test class behavior with redis logic.
    - [ ] Test Private methods logic

METHODS:
  - #generateMniningId()
  - #generateTaskInformation()
  - #stopTask()
  - #notifyChanges()
  - #updateProgress()
  - #hasCompleted()
  - #pubsubSendMessage()

 */

describe('Test TaskManager helper functions', () => {
  describe('utils.redactSensitiveData()', () => {
    it('should redact sensitive data from task', () => {
      const mockedTask: MiningTask = {
        userId: 'test-id-51fd-4e0f-b3bd-325664dd51e0',
        miningId:
          'test-id-51fd-4e0f-b3bd-325664dd51e0-f6494f8d-a96a-4f80-8a62-a081e57d5f14',
        process: {
          fetch: {} as TaskFetch,
          extract: {} as TaskExtract,
          enrich: {} as TaskVerify
        },
        progress: {
          totalMessages: 100,
          fetched: 50,
          extracted: 10,
          verifiedContacts: 5,
          createdContacts: 10
        },
        stream: {
          messagesStreamName: 'test-messages-stream-name',
          messagesConsumerGroupName: 'test-messages-consumer-group-name',
          emailsStreamName: 'test-emails-stream-name',
          emailsConsumerGroupName: 'test-emails-consumer-stream-name'
        },
        progressHandlerSSE: {} as RealtimeSSE,
        startedAt: performance.now()
      };

      const redactedTask: RedactedTask = {
        userId: mockedTask.userId,
        miningId: mockedTask.miningId,
        progress: {
          totalMessages: mockedTask.progress.totalMessages,
          fetched: mockedTask.progress.fetched,
          extracted: mockedTask.progress.extracted,
          verifiedContacts: mockedTask.progress.verifiedContacts,
          createdContacts: mockedTask.progress.createdContacts
        }
      };

      expect(redactSensitiveData(mockedTask)).toEqual(redactedTask);
    });
  });

  describe('utils.flickrBase58IdGenerator', () => {
    it('generates a random ID string', async () => {
      const idGeneratorLength = 10;
      const idGenerator = flickrBase58IdGenerator();

      const generatedId = await idGenerator(idGeneratorLength);

      expect(generatedId).toHaveLength(idGeneratorLength);
      expect(generatedId).toMatch(
        /^[123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ]+$/
      );
    });

    it('generates unique IDs', async () => {
      const idGenerator = flickrBase58IdGenerator();

      const id1 = await idGenerator(10);
      const id2 = await idGenerator(10);

      expect(id1).not.toEqual(id2);
    });

    it('generates IDs with correct length', async () => {
      const idGeneratorLength = 8; // Replace with the desired length of generated IDs
      const idGenerator = flickrBase58IdGenerator();

      const generatedId = await idGenerator(idGeneratorLength);

      expect(generatedId).toHaveLength(idGeneratorLength);
    });
  });
});

describe('TasksManager', () => {
  let tasksManager: TasksManager;
  const fetcherOptions: ImapEmailsFetcherOptions = {
    email: 'abc123@test.io',
    userId: 'abc123',
    batchSize: 0,
    boxes: ['test'],
    imapConnectionProvider: {} as ImapConnectionProvider,
    fetchEmailBody: false
  };

  beforeEach(() => {
    TasksManager.resetInstance(); // Reset singelton
    tasksManager = new TasksManager(
      tasksResolver,
      fakeRedisClient,
      fakeRedisClient,
      emailFetcherFactory as unknown as EmailFetcherFactory,
      sseBroadcasterFactory as unknown as SSEBroadcasterFactory,
      miningIdGenerator as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('TasksManager.constructor', () => {
    it('sould throw an error if constructed more than once', () => {
      try {
        /* eslint-disable-next-line no-new */
        new TasksManager(
          tasksResolver,
          fakeRedisClient,
          fakeRedisClient,
          emailFetcherFactory as unknown as EmailFetcherFactory,
          sseBroadcasterFactory as unknown as SSEBroadcasterFactory,
          miningIdGenerator as any
        );

        /* eslint-disable-next-line no-new */
        new TasksManager(
          tasksResolver,
          fakeRedisClient,
          fakeRedisClient,
          emailFetcherFactory as unknown as EmailFetcherFactory,
          sseBroadcasterFactory as unknown as SSEBroadcasterFactory,
          miningIdGenerator as any
        );
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty('message');
        expect((error as Error).message).toEqual(
          'TasksManager class cannot be instantiated more than once.'
        );
      }
    });

    describe('TasksManager.createTask', () => {
      it('should create a new mining task successfully', async () => {
        const task = await tasksManager.createTask(fetcherOptions);

        expect(task).toBeDefined();

        expect(miningIdGenerator).toHaveBeenCalledTimes(1);
        expect(sseBroadcasterFactory.create).toHaveBeenCalledTimes(1);
        expect(emailFetcherFactory.create).toHaveBeenCalledTimes(1);

        expect(miningIdGenerator).toHaveBeenCalledWith();
        expect(sseBroadcasterFactory.create).toHaveBeenCalledWith();
        expect(emailFetcherFactory.create).toHaveBeenCalledWith({
          miningId: task.miningId,
          streamName: `messages_stream-${task.miningId}`,
          ...fetcherOptions
        });

        expect(tasksResolver.create).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'fetch',
              category: TaskCategory.Mining,
              status: TaskStatus.Running
            }),
            expect.objectContaining({
              type: 'extract',
              category: TaskCategory.Mining,
              status: TaskStatus.Running
            }),
            expect.objectContaining({
              type: 'enrich',
              category: TaskCategory.Enrich,
              status: TaskStatus.Running
            })
          ])
        );

        expect(fakeRedisClient.subscribe).toHaveBeenCalledTimes(1);
        expect(fakeRedisClient.subscribe).toHaveBeenCalledWith(
          task.miningId,
          expect.any(Function)
        );

        expect(fakeRedisClient.xgroup).toHaveBeenCalledTimes(2);
        expect(fakeRedisClient.xgroup).toHaveBeenCalledWith(
          'CREATE',
          `messages_stream-${task.miningId}`,
          MESSAGES_STREAM_CONSUMER_GROUP,
          '$',
          'MKSTREAM'
        );
        expect(fakeRedisClient.xgroup).toHaveBeenCalledWith(
          'CREATE',
          `emails_stream-${task.miningId}`,
          EMAILS_STREAM_CONSUMER_GROUP,
          '$',
          'MKSTREAM'
        );
      });
    });

    describe('TasksManager.deleteTask', () => {
      it('should create a new mining task successfully', async () => {
        const task = await tasksManager.createTask(fetcherOptions);
        const deletedTask = await tasksManager.deleteTask(task.miningId);

        expect(deletedTask).toBeDefined();
        expect(deletedTask).toEqual(task);
        expect(() => tasksManager.getActiveTask(deletedTask.miningId)).toThrow(Error);

        expect(tasksResolver.update).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'fetch',
            category: TaskCategory.Mining,
            status: TaskStatus.Canceled
          })
        );
        expect(tasksResolver.update).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'extract',
            category: TaskCategory.Mining,
            status: TaskStatus.Canceled
          })
        );
        expect(tasksResolver.update).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'enrich',
            category: TaskCategory.Enrich,
            status: TaskStatus.Canceled
          })
        );

        expect(fakeRedisClient.xgroup).toHaveBeenCalledTimes(4); // 4 commands: 2 CREATE 2 DESTROY
        expect(fakeRedisClient.xgroup).toHaveBeenCalledWith(
          'DESTROY',
          `messages_stream-${task.miningId}`,
          MESSAGES_STREAM_CONSUMER_GROUP
        );
        expect(fakeRedisClient.xgroup).toHaveBeenCalledWith(
          'DESTROY',
          `emails_stream-${task.miningId}`,
          EMAILS_STREAM_CONSUMER_GROUP
        );
      });
    });

    describe('getActiveTask()', () => {
      it('should return the task object if it exists', async () => {
        const createdTask = await tasksManager.createTask(fetcherOptions);
        const retrievedTask = tasksManager.getActiveTask(createdTask.miningId);

        expect(retrievedTask.miningId).toBe(createdTask.miningId);
        expect(retrievedTask).toEqual(createdTask);
      });

      it('should throw an error if the task with the given mining ID does not exist', async () => {
        expect(() => tasksManager.getActiveTask('test-mining-id')).toThrow(
          Error
        );
      });
    });

    describe('attachSSE()', () => {
      it('should throw an error if the task with the given mining ID does not exist', async () => {
        const miningId = 'testing-mining-id';
        const req = httpMocks.createRequest();
        const res = httpMocks.createResponse();

        expect(() => tasksManager.attachSSE(miningId, { req, res })).toThrow(
          Error
        );
      });
    });
  });
});
