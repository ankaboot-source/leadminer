const { expect } = require('chai');
const {
  TasksManager,
  redactSensitiveData
} = require('../../app/services/TasksManager');

describe('TasksManager.redactSensitiveData()', () => {
  it('should redact sensetive data from task', () => {
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
          folders: ['test1'],
        },
      }
    };

    expect(redactSensitiveData(task)).to.eql(redactedTask);
  });
});

describe('TasksManager class', () => {
  const fakeRedisClient = {
    on: () => {
      return null;
    },
    subscribe: () => {
      return null;
    },
    publish: () => {
      return null
    },
    xgroup: () => {
      return null
    }
  };

  class EmailFetcherClass {

    getTotalMessages() {
      return 100
    };

    start() {
      return null
    };

  }

  class SSEBroadcasterClass {
    send() {
      return null
    }

    stop() {
      return null
    }
  }

  let tasksManager = null;

  beforeEach(() => {
    tasksManager = new TasksManager(
      'STREAM',
      fakeRedisClient,
      fakeRedisClient,
      EmailFetcherClass,
      SSEBroadcasterClass
    );
  });

  describe('generateMiningId()', () => {
    it('should generate a unique mining ID for a given user', async () => {
      const miningId1 = await tasksManager.generateMiningId();
      const miningId2 = await tasksManager.generateMiningId();

      expect(miningId1).to.not.equal(miningId2);
    });
  });

  describe('generateTaskInformation', () => {
    it('should generate task information with valid object', async () => {
      const task = await tasksManager.generateTaskInformation();

      expect(task).to.have.property('miningId');
      expect(task).to.have.property('stream');
      expect(task.stream).to.have.property('streamName');
      expect(task.stream).to.have.property('consumerGroupName');
      expect(task).to.have.property('progress');
      expect(task.progress).to.have.property('totalMessages');
      expect(task.progress.totalMessages).to.be.null;
      expect(task.progress).to.have.property('fetched');
      expect(task.progress.fetched).to.be.null;
      expect(task.progress).to.have.property('extracted');
      expect(task.progress.extracted).to.be.null;
      expect(task).to.have.property('fetcher');
      expect(task.fetcher).to.be.null;
      expect(task).to.have.property('progressHandlerSSE');
      expect(task.progressHandlerSSE).to.be.null;
    });
  });

  describe('createTask()', () => {
    it('should create a new mining task.', async () => {
      const userId = 'abc123';
      const fetcherOptions = { email: '', userId, imapConnectionProvider: {} }
      const { task } = await tasksManager.createTask(userId, fetcherOptions);

      expect(task).to.have.all.keys(
        'miningId',
        'userId',
        'progress',
        'fetcher',
      );

      expect(task.progress).to.have.all.keys('totalMessages', 'extracted', 'fetched')
      expect(task.fetcher).to.have.all.keys('status', 'folders')

    });

    it('should throw an error if mining ID already exists', async () => {
      const userId = 'abc123';
      const miningId = await tasksManager.generateMiningId(userId);

      await tasksManager.createTask(miningId, { email: '', userId, imapConnectionProvider: {} });

      try {
        await tasksManager.createTask(miningId, { email: '', userId, imapConnectionProvider: {} })
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect(error.message).equal(`Task with mining ID ${miningId} already exists.`)
      }

    });
  });

  describe('getActiveTask()', () => {
    it('should return the task object if it exists', async () => {
      const userId = 'abc123';
      const fetcherOptions = { email: '', userId, imapConnectionProvider: {} };

      // Create a new task and retrieve it from the tasksManager
      const createdTask = await tasksManager.createTask(userId, fetcherOptions);
      const retrievedTask = tasksManager.getActiveTask(createdTask.task.miningId);

      expect(retrievedTask).to.be.an('object');
      expect(retrievedTask.task.miningId).to.equal(createdTask.task.miningId);
      expect(retrievedTask).to.eql(createdTask);
    });

    it('should throw an error if the task with the given mining ID does not exist', () => {
      const miningId = tasksManager.generateMiningId();

      expect(() => tasksManager.getActiveTask(miningId)).to.throw(Error);
    });
  });

  describe('attachSSE()', () => {
    it('should throw an error if the task with the given mining ID does not exist', async () => {
      const miningId = await tasksManager.generateMiningId();

      expect(() => tasksManager.attachSSE(miningId, {})).to.Throw(Error);
    });
  });

  describe('deleteTask()', () => {
    it('should throw an error if the task with the given mining ID does not exist', async () => {
      try {
        await tasksManager.deleteTask('false-id');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });

    it('should delete the task with the given mining ID if it exists', async () => {
      const userId = '123';
      const fetcherOptions = { email: '', userId, imapConnectionProvider: {} }
      const miningId = await tasksManager.generateMiningId();
      const createdTask = await tasksManager.createTask(userId, fetcherOptions);
      const deletedTask = await tasksManager.deleteTask(createdTask.task.miningId);

      expect(deletedTask).to.eql(createdTask);
      expect(() => tasksManager.getActiveTask(miningId)).to.throw(Error);
    });
  });
});

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
