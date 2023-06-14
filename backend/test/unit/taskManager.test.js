import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import TasksManager from '../../src/services/tasks-manager/TasksManager';
import { redactSensitiveData } from '../../src/services/tasks-manager/utils';

jest.mock('../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error'
}));
/*

TODO: 
    - Mock redis and Test class behavior with redis logic.
    - Test Private methods logic


METHODS:
  - generateTaskInformation()
  - #notifyChanges()
  - #updateProgress()
  - #hasCompleted()
  - #pubsubSendMessage()

 */

describe.skip('TasksManager.redactSensitiveData()', () => {
  it('should redact sensitive data from task', () => {
    const task = {
      userId: 'fffffffff-51fd-4e0f-b3bd-325664dd51e0',
      miningId:
        'ffffffff-51fd-4e0f-b3bd-325664dd51e0-f6494f8d-a96a-4f80-8a62-a081e57d5f14',
      progress: {
        totalMessages: 100,
        fetched: null,
        extracted: null
      },
      fetcher: {
        imapConnectionProvider: {},
        folders: ['test1'],
        userId: 'ffffffff-51fd-4e0f-b3bd-325664dd51e0',
        userEmail: 'leadminer@leadminer.io',
        userIdentifier:
          'fffffffffff4e4aa0b2de228b80967a7f36a316b53efa3516d601656b6cfc',
        miningId:
          'ffffffffff-51fd-4e0f-b3bd-325664dd51e0-f6494f8d-a96a-4f80-8a62-a081e57d5f14',
        processSetKey:
          'caching:ffffffff-51fd-4e0f-b3bd-325664dd51e0-f6494f8d-a96a-4f80-8a62-a081e57d5f14',
        fetchedIds: {},
        bodies: ['HEADER']
      },
      sseProgressHandler: null
    };

    const redactedTask = {
      task: {
        userId: 'fffffffff-51fd-4e0f-b3bd-325664dd51e0',
        miningId:
          'ffffffff-51fd-4e0f-b3bd-325664dd51e0-f6494f8d-a96a-4f80-8a62-a081e57d5f14',
        progress: {
          totalMessages: 100,
          fetched: null,
          extracted: null
        },
        fetcher: {
          status: 'running',
          folders: ['test1']
        }
      }
    };

    expect(redactSensitiveData(task)).toEqual(redactedTask);
  });
});

describe.skip('TasksManager class', () => {
  const fakeRedisClient = {
    on: () => null,
    subscribe: () => null,
    publish: () => null,
    xgroup: () => null,
    del: () => null
  };

  const emailFetcherFactory = () => ({
    create: () => ({
      getTotalMessages: () => 100,
      start: () => null,
      stop: () => null
    })
  });

  const sseBroadcasterFactory = () => ({
    create: () => ({
      send: () => null,
      stop: () => null
    })
  });

  let tasksManager = null;

  beforeEach(() => {
    tasksManager = new TasksManager(
      fakeRedisClient,
      fakeRedisClient,
      emailFetcherFactory(),
      sseBroadcasterFactory()
    );
  });

  describe('generateMiningId()', () => {
    //
    it('should generate a unique mining ID for a given user', async () => {
      const miningId1 = await tasksManager.generateMiningId();
      const miningId2 = await tasksManager.generateMiningId();

      const areDifferent = miningId1 !== miningId2;

      expect(areDifferent).toBe(true);
    });
  });

  describe('generateTaskInformation', () => {
    it('should generate task information with valid object', async () => {
      const task = await tasksManager.generateTaskInformation();

      expect(task).toHaveProperty('miningId');
      expect(task).toHaveProperty('stream');
      expect(task.stream).toHaveProperty('streamName');
      expect(task.stream).toHaveProperty('consumerGroupName');
      expect(task).toHaveProperty('progress');
      expect(task.progress).toHaveProperty('totalMessages');
      expect(task.progress.totalMessages).toBeNull();
      expect(task.progress).toHaveProperty('fetched');
      expect(task.progress.fetched).toBeNull();
      expect(task.progress).toHaveProperty('extracted');
      expect(task.progress.extracted).toBeNull();
      expect(task).toHaveProperty('fetcher');
      expect(task.fetcher).toBeNull();
      expect(task).toHaveProperty('progressHandlerSSE');
      expect(task.progressHandlerSSE).toBeNull();
    });
  });

  describe('createTask()', () => {
    it('should create a new mining task.', async () => {
      const userId = 'abc123';
      const fetcherOptions = { email: '', userId, imapConnectionProvider: {} };
      const { task } = await tasksManager.createTask(userId, fetcherOptions);

      expect(task).toHaveProperty([
        'miningId',
        'userId',
        'progress',
        'fetcher'
      ]);

      expect(task.progress).toHaveProperty([
        'totalMessages',
        'extracted',
        'fetched'
      ]);
      expect(task.fetcher).toHaveProperty(['status', 'folders']);
    });

    it('should throw an error if mining ID already exists', async () => {
      const userId = 'abc123';
      const miningId = await tasksManager.generateMiningId(userId);

      await tasksManager.createTask(miningId, {
        email: '',
        userId,
        imapConnectionProvider: {}
      });

      try {
        await tasksManager.createTask(miningId, {
          email: '',
          userId,
          imapConnectionProvider: {}
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe(
          `Task with mining ID ${miningId} already exists.`
        );
      }
    });
  });

  describe('getActiveTask()', () => {
    it('should return the task object if it exists', async () => {
      const userId = 'abc123';
      const fetcherOptions = { email: '', userId, imapConnectionProvider: {} };

      // Create a new task and retrieve it from the tasksManager
      const createdTask = await tasksManager.createTask(userId, fetcherOptions);
      const retrievedTask = tasksManager.getActiveTask(
        createdTask.task.miningId
      );

      expect(retrievedTask.task.miningId).toBe(createdTask.task.miningId);
      expect(retrievedTask).toEqual(createdTask);
    });

    it('should throw an error if the task with the given mining ID does not exist', () => {
      const miningId = tasksManager.generateMiningId();

      expect(() => tasksManager.getActiveTask(miningId)).toThrow(Error);
    });
  });

  describe('attachSSE()', () => {
    it('should throw an error if the task with the given mining ID does not exist', async () => {
      const miningId = await tasksManager.generateMiningId();

      expect(() => tasksManager.attachSSE(miningId, {})).toThrow(Error);
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

    it('should delete the task with the given mining ID if it exists', async () => {
      const userId = '123';
      const fetcherOptions = { email: '', userId, imapConnectionProvider: {} };
      const miningId = await tasksManager.generateMiningId();
      const createdTask = await tasksManager.createTask(userId, fetcherOptions);
      const deletedTask = await tasksManager.deleteTask(
        createdTask.task.miningId
      );

      expect(deletedTask).toEqual(createdTask);
      expect(() => tasksManager.getActiveTask(miningId)).toThrow(Error);
    });
  });
});
