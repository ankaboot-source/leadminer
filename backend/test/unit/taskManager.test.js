const { expect } = require('chai');
const {
  TasksManager,
  generateMiningId,
  redactSensitiveData
} = require('../../app/services/TasksManager');

describe('TasksManager.generateMiningId()', () => {
  it('should generate a unique mining ID for a given user', () => {
    const miningID1 = generateMiningId();
    const miningID2 = generateMiningId();

    expect(miningID1).to.not.equal(miningID2);
  });
});

describe('TasksManager.redactSensitiveData()', () => {
  it('should redact sensetive data from task', () => {
    const task = {
      userId: 'fffffffff-51fd-4e0f-b3bd-325664dd51e0',
      miningId: 'ffffffff-51fd-4e0f-b3bd-325664dd51e0-f6494f8d-a96a-4f80-8a62-a081e57d5f14',
      miningProgress: {
        fetching: 0,
        extracting: 0
      },
      fetcher: {
        imapConnectionProvider: {},
        folders: [
          'test1'
        ],
        userId: 'ffffffff-51fd-4e0f-b3bd-325664dd51e0',
        userEmail: 'leadminer@leadminer.io',
        userIdentifier: 'fffffffffff4e4aa0b2de228b80967a7f36a316b53efa3516d601656b6cfc',
        miningId: 'ffffffffff-51fd-4e0f-b3bd-325664dd51e0-f6494f8d-a96a-4f80-8a62-a081e57d5f14',
        processSetKey: 'caching:ffffffff-51fd-4e0f-b3bd-325664dd51e0-f6494f8d-a96a-4f80-8a62-a081e57d5f14',
        fetchedIds: {},
        bodies: [
          'HEADER'
        ]
      },
      sseProgressHandler: null
    }

    redactedTask = {
      task: {
        userId: 'fffffffff-51fd-4e0f-b3bd-325664dd51e0',
        miningId: 'ffffffff-51fd-4e0f-b3bd-325664dd51e0-f6494f8d-a96a-4f80-8a62-a081e57d5f14',
        miningProgress: {
          fetching: 0,
          extracting: 0
        },
        fetcher: {
          folders: [
            'test1'
          ],
          userId: 'ffffffff-51fd-4e0f-b3bd-325664dd51e0',
          userEmail: 'leadminer@leadminer.io',
          bodies: [
            'HEADER'
          ]
        },
      }
    }

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
    }
  };
  const fetcherInstance = {
    cleanup: () => {
      return null;
    }
  };
  const sseInstance = {
    send: () => {
      return null;
    }
  };
  let tasksManager = null;

  beforeEach(() => {
    tasksManager = new TasksManager(fakeRedisClient);
  });

  describe('createTask()', () => {
    it('should create a new mining task.', () => {
      const userId = 'abc123';
      const miningId = generateMiningId(userId);
      const task = tasksManager.createTask(miningId, userId, fetcherInstance);
      const expectedOutput = {
        userId,
        miningId,
        miningProgress: {
          fetched: 0,
          extracted: 0
        },
        fetcher: fetcherInstance,
        sseProgressHandler: null
      }
      expect(task).eql(redactSensitiveData(expectedOutput));
    });

    it('should throw an error if mining ID already exists', () => {
      const userID = 'abc123';
      const miningID = generateMiningId(userID);
      tasksManager.createTask(miningID, userID, fetcherInstance);
      expect(() =>
        tasksManager.createTask(miningID, userID, fetcherInstance)
      ).to.Throw(Error);
    });
  });

  describe('getActiveTask()', () => {
    it('should return the task object if it exists', () => {
      const userID = 'abc123';
      const miningId = generateMiningId();
      const createdTask = tasksManager.createTask(
        miningId,
        userID,
        fetcherInstance
      );
      const retirevedTask = tasksManager.getActiveTask(miningId);

      expect(retirevedTask).to.be.an('object');
      expect(retirevedTask.task.miningId).to.equal(miningId);
      expect(retirevedTask).to.eql(createdTask);
    });

    it('should throw an error if the task with the given mining ID does not exist', () => {
      const userID = 'abc123';
      const miningId = generateMiningId(userID);
    
      expect(() => tasksManager.getActiveTask(miningId)).to.throw(Error);
    });
  });

  describe('attachSSE()', () => {

    it('should throw an error if the task with the given mining ID does not exist', () => {
      const userId = 'abc123';
      const miningId = generateMiningId(userId);

      expect(() => tasksManager.attachSSE(miningId, sseInstance)).to.Throw(
        Error
      );
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
      const miningId = generateMiningId();
      const createdTask = tasksManager.createTask(
        miningId,
        userId,
        fetcherInstance
      );
      const deletedTask = await tasksManager.deleteTask(miningId);

      expect(deletedTask).to.deep.equal(createdTask);
      expect(() => tasksManager.getActiveTask(miningId)).to.throw(Error);
    });
  });
});

/*

TODO: 
    - Mock redis and Test class behavior with redis logic.
    - Test Private methods logic


Cases:
    expect(redis.getDuplicatedClient).toHaveBeenCalled();
    expect(tasksManager.progressSubscriber.subscribe).toHaveBeenCalledWith(miningID, expect.any(Function))
    expect(redis.getDuplicatedClient).toHaveBeenCalledTimes(1);

describe('#notifyProgress()', () => {

    it('should throw an error if the task with the given mining ID does not exist', () => {
        expect(() => TasksManager.notifyProgress('false-id', 'fetching')).to.Throw(Error);
        expect(() => TasksManager.notifyProgress('false-id', 'extracting')).to.Throw(Error);   
    });
});

describe('#updateProgress()', () => {

    it('should throw an error if the task with the given mining ID does not exist', () => {     
        expect(() => TasksManager.updateProgress('false-id', 'fetching')).to.Throw(Error);
        expect(() => TasksManager.updateProgress('false-id', 'extracting')).to.Throw(Error);    
    });
});

 */
