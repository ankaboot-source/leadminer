import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MiningManager from '../../../src/services/mining/MiningManager';

describe('MiningManager', () => {
  let manager: MiningManager;
  let mockTasksResolver: any;
  let mockRedisSubscriber: any;
  let mockRedisPublisher: any;
  let mockSseBroadcasterFactory: any;

  beforeEach(() => {
    mockTasksResolver = {
      create: jest.fn().mockResolvedValue({ id: 'task-1' })
    };
    mockRedisSubscriber = { subscribe: jest.fn(), on: jest.fn() };
    mockRedisPublisher = { xgroup: jest.fn(), publish: jest.fn() };
    mockSseBroadcasterFactory = {
      create: jest.fn().mockReturnValue({
        subscribeSSE: jest.fn(),
        sendSSE: jest.fn()
      })
    };

    manager = new MiningManager({
      tasksResolver: mockTasksResolver,
      redisSubscriber: mockRedisSubscriber,
      redisPublisher: mockRedisPublisher,
      sseBroadcasterFactory: mockSseBroadcasterFactory,
      idGenerator: async () => 'test-mining-id'
    });
  });

  it('should create mining manager', () => {
    expect(manager).toBeDefined();
  });
});
