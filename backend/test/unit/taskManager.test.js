const { expect } = require('chai');
const { TasksManager, generateMiningId } = require('../../app/services/TasksManager');

describe('TasksManager.generateMiningId()', () => {
    it('should generate a unique mining ID for a given user', () => {
      const userId = '123456';
      const miningID1 = generateMiningId(userId);
      const miningID2 = generateMiningId(userId);

      expect(miningID1).to.not.equal(miningID2);
      expect(miningID1).to.have.string(userId);
      expect(miningID2).to.have.string(userId);
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

      expect(task).eql({
        userId,
        miningId,
        miningProgress: {
          fetching: 0,
          extracting: 0
        },
        fetcher: fetcherInstance,
        sseProgressHandler: null
      });
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
      const miningId = generateMiningId(userID);
      const createdTask = tasksManager.createTask(
        miningId,
        userID,
        fetcherInstance
      );
      const retirevedTask = tasksManager.getActiveTask(miningId);

      expect(retirevedTask).to.be.an('object');
      expect(retirevedTask.miningId).to.equal(miningId);
      expect(retirevedTask).to.eql(createdTask);
    });

    it('should throw an error if the task with the given mining ID does not exist', () => {
      const userID = 'abc123';
      const miningId = generateMiningId(userID);
      const retirevedTask = tasksManager.getActiveTask(miningId);

      expect(retirevedTask).to.be.null;
    });
  });

  describe('attachSSE()', () => {
    it('should attach an SSE instance to a mining task', () => {
      const userId = 'abc123';
      const miningId = generateMiningId(userId);

      tasksManager.createTask(miningId, userId, fetcherInstance);
      tasksManager.attachSSE(miningId, sseInstance);

      expect(tasksManager.getActiveTask(miningId).sseProgressHandler).eql(
        sseInstance
      );
    });

    it('should attach new instance and delete old if exists', () => {
      const userId = 'abc123';
      const miningId = generateMiningId(userId);
      const sseInstance2 = {
        send: () => {
          return null;
        }
      };
      tasksManager.createTask(miningId, userId, fetcherInstance);

      tasksManager.attachSSE(miningId, sseInstance);
      tasksManager.attachSSE(miningId, sseInstance2);

      expect(tasksManager.getActiveTask(miningId).sseProgressHandler).eql(
        sseInstance2
      );
    });

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
      const miningId = generateMiningId(userId);
      const createdTask = tasksManager.createTask(
        miningId,
        userId,
        fetcherInstance
      );
      const deletedTask = await tasksManager.deleteTask(miningId);

      expect(deletedTask).to.deep.equal(createdTask);
      expect(tasksManager.getActiveTask(miningId)).to.be.null;
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
