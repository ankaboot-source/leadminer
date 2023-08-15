import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Worker } from 'bullmq';
import RedisMock from 'ioredis-mock';
import httpMocks from 'node-mocks-http';
import EmailFetcherFactory from '../../src/services/factory/EmailFetcherFactory';
import SSEBroadcasterFactory from '../../src/services/factory/SSEBroadcasterFactory';
import ImapEmailsFetcher from '../../src/services/imap/ImapEmailsFetcher';
import TasksManager from '../../src/services/tasks-manager/TasksManager';
import { RedactedTask, Task } from '../../src/services/tasks-manager/types';
import {
  flickrBase58IdGenerator,
  redactSensitiveData
} from '../../src/services/tasks-manager/utils';
import RealtimeSSE from '../../src/utils/helpers/sseHelpers';

import { Contacts } from '../../src/db/Contacts';
import FakeEmailStatusVerifier from '../fakes/FakeEmailVerifier';

jest.mock('../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error'
}));

jest.mock('ioredis', () => jest.requireActual('ioredis-mock'));
const fakeRedisClient = new RedisMock();

jest.mock('../../src/services/factory/EmailFetcherFactory', () =>
  jest.fn().mockImplementation(() => ({
    create: () => ({
      getTotalMessages: jest.fn(() => 100),
      start: jest.fn(),
      stop: jest.fn()
    })
  }))
);

jest.mock('../../src/services/factory/SSEBroadcasterFactory', () =>
  jest.fn().mockImplementation(() => ({
    create: () => ({
      send: jest.fn(),
      stop: jest.fn()
    })
  }))
);

const emailFetcherFactory = new EmailFetcherFactory();
const sseBroadcasterFactory = new SSEBroadcasterFactory();
const miningIdGenerator = jest.fn(() => {
  const randomId = Math.random().toString(36).substring(2);
  return Promise.resolve(`test-id-${randomId}`);
});
const fakeContacts: Contacts = {
  create: jest.fn(() => Promise.resolve()),
  refine: jest.fn(() => Promise.resolve(true)),
  updatePersonStatus: jest.fn(() => Promise.resolve(true))
};

/*

TODO: 
    - [ ] Mock redis and Test class behavior with redis logic.
    - [ ] Test Private methods logic


METHODS:
  - generateTaskInformation()
  - #notifyChanges()
  - #updateProgress()
  - #hasCompleted()
  - #pubsubSendMessage()

 */

describe('Test TaskManager helper functions', () => {
  describe('utils.redactSensitiveData()', () => {
    it('should redact sensitive data from task', () => {
      const task: Task = {
        userId: 'test-id-51fd-4e0f-b3bd-325664dd51e0',
        miningId:
          'test-id-51fd-4e0f-b3bd-325664dd51e0-f6494f8d-a96a-4f80-8a62-a081e57d5f14',
        progress: {
          totalMessages: 100,
          fetched: 50,
          extracted: 10
        },
        fetcher: {
          status: 'running',
          folders: ['test']
        } as unknown as ImapEmailsFetcher,
        progressHandlerSSE: {} as RealtimeSSE,
        emailVerificationWorker: {
          isRunning: () => { return false }
        } as Worker,
        stream: {
          streamName: 'test-stream',
          consumerGroupName: 'test-group'
        },
        startedAt: Date.now()
      };

      const redactedTask: RedactedTask = {
        userId: task.userId,
        miningId: task.miningId,
        progress: {
          totalMessages: task.progress.totalMessages,
          fetched: task.progress.fetched,
          extracted: task.progress.extracted
        },
        fetcher: {
          status: 'running',
          folders: ['test']
        },
        emailStatusVerifier: {
          running: false
        }
      };

      expect(redactSensitiveData(task)).toEqual(redactedTask);
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

describe('TasksManager class', () => {
  let tasksManager: TasksManager;

  beforeEach(() => {
    TasksManager.resetInstance(); // Reset singelton
    tasksManager = new TasksManager(
      fakeRedisClient,
      fakeRedisClient,
      new FakeEmailStatusVerifier({}),
      fakeContacts,
      emailFetcherFactory,
      sseBroadcasterFactory,
      miningIdGenerator
    );
  });

  describe('generateMiningId()', () => {
    it('should generate a unique mining ID for a given user', async () => {
      const miningId1 = await tasksManager.generateMiningId();
      const miningId2 = await tasksManager.generateMiningId();

      const areDifferent = miningId1 !== miningId2;

      expect(areDifferent).toBe(true);
    });
  });

  describe('createTask()', () => {
    it('sould throw an error if constructed more than once', () => {
      try {
        const instance1 = new TasksManager(
          fakeRedisClient,
          fakeRedisClient,
          new FakeEmailStatusVerifier({}),
          fakeContacts,
          emailFetcherFactory,
          sseBroadcasterFactory,
          miningIdGenerator
        );

        const instance2 = new TasksManager(
          fakeRedisClient,
          fakeRedisClient,
          new FakeEmailStatusVerifier({}),
          fakeContacts,
          emailFetcherFactory,
          sseBroadcasterFactory,
          miningIdGenerator
        );

        expect(instance1).not.toEqual(instance2);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty('message');
        expect((error as Error).message).toEqual(
          'TasksManager class cannot be instantiated more than once.'
        );
      }
    });

    describe('getActiveTask()', () => {
      //   it('should return the task object if it exists', async () => {
      //     const fetcherOptions: ImapEmailsFetcherOptions = {
      //       email: 'abc123@test.io',
      //       userId: 'abc123',
      //       batchSize: 0,
      //       boxes: ['test'],
      //       imapConnectionProvider: {} as ImapConnectionProvider,
      //       fetchEmailBody: false
      //     };
      //     // Create a new task and retrieve it from the tasksManager
      //     const createdTask = await tasksManager.createTask(fetcherOptions);
      //     const retrievedTask = tasksManager.getActiveTask(createdTask.miningId);

      //     expect(retrievedTask.miningId).toBe(createdTask.miningId);
      //     expect(retrievedTask).toEqual(createdTask);
      //   });

      it('should throw an error if the task with the given mining ID does not exist', async () => {
        const miningId = await tasksManager.generateMiningId();

        expect(() => tasksManager.getActiveTask(miningId)).toThrow(Error);
      });
    });

    describe('attachSSE()', () => {
      it('should throw an error if the task with the given mining ID does not exist', async () => {
        const miningId = await tasksManager.generateMiningId();
        const req = httpMocks.createRequest();
        const res = httpMocks.createResponse();

        expect(() => tasksManager.attachSSE(miningId, { req, res })).toThrow(
          Error
        );
      });
    });

    describe('deleteTask()', () => {
      it('should throw an error if the task with the given mining ID does not exist', async () => {
        try {
          await tasksManager.deleteTask('false-id');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      //   it('should delete the task with the given mining ID if it exists', async () => {
      //     const fetcherOptions: ImapEmailsFetcherOptions = {
      //       email: 'abc123@test.io',
      //       userId: 'abc123',
      //       batchSize: 0,
      //       boxes: ['test'],
      //       imapConnectionProvider: {} as ImapConnectionProvider,
      //       fetchEmailBody: false
      //     };
      //     const miningId = await tasksManager.generateMiningId();
      //     const createdTask = await tasksManager.createTask(fetcherOptions);
      //     const deletedTask = await tasksManager.deleteTask(createdTask.miningId);

      //     expect(deletedTask).toEqual(createdTask);
      //     expect(() => tasksManager.getActiveTask(miningId)).toThrow(Error);
      //   });
    });
  });
});
