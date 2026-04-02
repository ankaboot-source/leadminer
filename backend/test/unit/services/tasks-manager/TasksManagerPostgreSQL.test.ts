import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import { Redis } from 'ioredis';
import TasksManagerPostgreSQL from '../../../../src/services/tasks-manager/TasksManagerPostgreSQL';
import SupabaseTasks from '../../../../src/db/supabase/tasks';
import SSEBroadcasterFactory from '../../../../src/services/factory/SSEBroadcasterFactory';
import RealtimeSSE from '../../../../src/utils/helpers/sseHelpers';
import { TaskCategory, TaskStatus, TaskType } from '../../../../src/db/types';

// Mock dependencies
jest.mock('../../../../src/config', () => ({
  LEADMINER_API_LOG_LEVEL: 'error',
  REDIS_EXTRACTING_STREAM_CONSUMER_GROUP: 'fake-group-extracting',
  REDIS_CLEANING_STREAM_CONSUMER_GROUP: 'fake-group-cleaning',
  REDIS_PUBSUB_COMMUNICATION_CHANNEL: 'test-channel'
}));

jest.mock('../../../../src/utils/helpers/sseHelpers');
jest.mock('../../../../src/utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

describe('TasksManagerPostgreSQL', () => {
  let tasksManager: TasksManagerPostgreSQL;
  let mockTasksResolver: jest.Mocked<SupabaseTasks>;
  let mockRedisSubscriber: jest.Mocked<Redis>;
  let mockRedisPublisher: jest.Mocked<Redis>;
  let mockSSEBroadcasterFactory: jest.Mocked<SSEBroadcasterFactory>;
  let mockRealtimeSSE: jest.Mocked<RealtimeSSE>;

  const mockUserId = 'user-123';
  const mockSourceName = 'postgresql://localhost:5432/mydb';
  const mockTotalRows = 100;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock RealtimeSSE instance
    mockRealtimeSSE = {
      subscribeSSE: jest.fn(),
      sendSSE: jest.fn(),
      stop: jest.fn()
    } as unknown as jest.Mocked<RealtimeSSE>;

    (RealtimeSSE as jest.MockedClass<typeof RealtimeSSE>).mockImplementation(
      () => mockRealtimeSSE
    );

    // Create mock SupabaseTasks
    mockTasksResolver = {
      create: jest.fn(),
      update: jest.fn(),
      getById: jest.fn()
    } as unknown as jest.Mocked<SupabaseTasks>;

    // Create mock Redis instances
    mockRedisSubscriber = {
      on: jest.fn(),
      subscribe: jest.fn()
    } as unknown as jest.Mocked<Redis>;

    mockRedisPublisher = {
      xgroup: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      publish: jest.fn().mockResolvedValue(1)
    } as unknown as jest.Mocked<Redis>;

    // Create mock SSEBroadcasterFactory
    mockSSEBroadcasterFactory = {
      create: jest.fn().mockReturnValue(mockRealtimeSSE)
    } as unknown as jest.Mocked<SSEBroadcasterFactory>;

    // Create instance of TasksManagerPostgreSQL
    tasksManager = new TasksManagerPostgreSQL(
      mockTasksResolver,
      mockRedisSubscriber,
      mockRedisPublisher,
      mockSSEBroadcasterFactory
    );
  });

  describe('createTask', () => {
    it('should create a task and return redacted task data', async () => {
      // Arrange
      const mockTaskExtract = {
        id: 'task-extract-123',
        startedAt: new Date().toISOString()
      };
      const mockTaskClean = {
        id: 'task-clean-456',
        startedAt: new Date().toISOString()
      };

      mockTasksResolver.create
        .mockResolvedValueOnce(mockTaskExtract as never)
        .mockResolvedValueOnce(mockTaskClean as never);

      // Act
      const result = await tasksManager.createTask(
        mockUserId,
        mockSourceName,
        mockTotalRows
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.userId).toBe(mockUserId);
      expect(result.miningSource.source).toBe(mockSourceName);
      expect(result.miningSource.type).toBe('postgresql');
      expect(result.processes.extract).toBe(mockTaskExtract.id);
      expect(result.processes.clean).toBe(mockTaskClean.id);
      expect(result.progress.totalImported).toBe(mockTotalRows);

      // Verify SupabaseTasks.create was called twice (for extract and clean)
      expect(mockTasksResolver.create).toHaveBeenCalledTimes(2);

      // Verify Redis subscriber was set up
      expect(mockRedisSubscriber.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );

      // Verify Redis subscription
      expect(mockRedisSubscriber.subscribe).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function)
      );
    });

    it('should create TaskExtract with correct structure', async () => {
      // Arrange
      const mockTaskExtract = {
        id: 'task-extract-123',
        startedAt: new Date().toISOString()
      };
      const mockTaskClean = {
        id: 'task-clean-456',
        startedAt: new Date().toISOString()
      };

      mockTasksResolver.create
        .mockResolvedValueOnce(mockTaskExtract as never)
        .mockResolvedValueOnce(mockTaskClean as never);

      // Act
      await tasksManager.createTask(mockUserId, mockSourceName, mockTotalRows);

      // Assert - Check first call for extract task
      const extractCall = mockTasksResolver.create.mock.calls[0][0];
      expect(extractCall.userId).toBe(mockUserId);
      expect(extractCall.category).toBe(TaskCategory.Mining);
      expect(extractCall.type).toBe(TaskType.Extract);
      expect(extractCall.status).toBe(TaskStatus.Running);
      expect(extractCall.details.miningId).toBeDefined();
      expect(extractCall.details.stream.messagesStream).toBeDefined();
      expect(extractCall.details.stream.messagesConsumerGroup).toBeDefined();
      expect(extractCall.details.stream.emailsVerificationStream).toBeDefined();
      expect(extractCall.details.progress.extracted).toBe(0);
    });

    it('should create TaskClean with correct structure', async () => {
      // Arrange
      const mockTaskExtract = {
        id: 'task-extract-123',
        startedAt: new Date().toISOString()
      };
      const mockTaskClean = {
        id: 'task-clean-456',
        startedAt: new Date().toISOString()
      };

      mockTasksResolver.create
        .mockResolvedValueOnce(mockTaskExtract as never)
        .mockResolvedValueOnce(mockTaskClean as never);

      // Act
      await tasksManager.createTask(mockUserId, mockSourceName, mockTotalRows);

      // Assert - Check second call for clean task
      const cleanCall = mockTasksResolver.create.mock.calls[1][0];
      expect(cleanCall.userId).toBe(mockUserId);
      expect(cleanCall.category).toBe(TaskCategory.Cleaning);
      expect(cleanCall.type).toBe(TaskType.Clean);
      expect(cleanCall.status).toBe(TaskStatus.Running);
      expect(cleanCall.details.miningId).toBeDefined();
      expect(cleanCall.details.stream.emailsStream).toBeDefined();
      expect(cleanCall.details.stream.emailsConsumerGroup).toBeDefined();
      expect(cleanCall.details.progress.verifiedContacts).toBe(0);
      expect(cleanCall.details.progress.createdContacts).toBe(0);
    });

    it('should throw error when tasksResolver.create fails', async () => {
      // Arrange
      mockTasksResolver.create.mockRejectedValue(
        new Error('Database error') as never
      );

      // Act & Assert
      await expect(
        tasksManager.createTask(mockUserId, mockSourceName, mockTotalRows)
      ).rejects.toThrow('Database error');
    });
  });

  describe('getTaskOrThrow', () => {
    it('should return task when miningId exists', async () => {
      // Arrange - First create a task
      const mockTaskExtract = {
        id: 'task-extract-123',
        startedAt: new Date().toISOString()
      };
      const mockTaskClean = {
        id: 'task-clean-456',
        startedAt: new Date().toISOString()
      };

      mockTasksResolver.create
        .mockResolvedValueOnce(mockTaskExtract as never)
        .mockResolvedValueOnce(mockTaskClean as never);

      const createdTask = await tasksManager.createTask(
        mockUserId,
        mockSourceName,
        mockTotalRows
      );
      const { miningId } = createdTask;

      // Act
      const task = tasksManager.getTaskOrThrow(miningId);

      // Assert
      expect(task).toBeDefined();
      expect(task.miningId).toBe(miningId);
      expect(task.userId).toBe(mockUserId);
    });

    it('should throw error when miningId does not exist', () => {
      // Act & Assert
      expect(() => tasksManager.getTaskOrThrow('non-existent-id')).toThrow(
        'Task with mining ID non-existent-id does not exist.'
      );
    });
  });

  describe('getActiveTask', () => {
    it('should return redacted task when miningId exists', async () => {
      // Arrange - First create a task
      const mockTaskExtract = {
        id: 'task-extract-123',
        startedAt: new Date().toISOString()
      };
      const mockTaskClean = {
        id: 'task-clean-456',
        startedAt: new Date().toISOString()
      };

      mockTasksResolver.create
        .mockResolvedValueOnce(mockTaskExtract as never)
        .mockResolvedValueOnce(mockTaskClean as never);

      const createdTask = await tasksManager.createTask(
        mockUserId,
        mockSourceName,
        mockTotalRows
      );
      const { miningId } = createdTask;

      // Act
      const task = tasksManager.getActiveTask(miningId);

      // Assert
      expect(task).toBeDefined();
      expect(task.miningId).toBe(miningId);
      expect(task.userId).toBe(mockUserId);
      expect(task.processes.extract).toBe(mockTaskExtract.id);
      expect(task.processes.clean).toBe(mockTaskClean.id);
      // Should be redacted - no progressHandlerSSE
      expect((task as any).progressHandlerSSE).toBeUndefined();
    });

    it('should throw error when miningId does not exist', () => {
      // Act & Assert
      expect(() => tasksManager.getActiveTask('non-existent-id')).toThrow(
        'Task with mining ID non-existent-id does not exist.'
      );
    });
  });

  describe('deleteTask', () => {
    it('should mark tasks as canceled and clean up when no processIds provided', async () => {
      // Arrange - First create a task
      const mockTaskExtract = {
        id: 'task-extract-123',
        startedAt: new Date().toISOString()
      };
      const mockTaskClean = {
        id: 'task-clean-456',
        startedAt: new Date().toISOString()
      };

      mockTasksResolver.create
        .mockResolvedValueOnce(mockTaskExtract as never)
        .mockResolvedValueOnce(mockTaskClean as never);

      const createdTask = await tasksManager.createTask(
        mockUserId,
        mockSourceName,
        mockTotalRows
      );
      const { miningId } = createdTask;

      // Act
      const result = await tasksManager.deleteTask(miningId, null);

      // Assert
      expect(result).toBeDefined();
      expect(result.miningId).toBe(miningId);

      // Verify tasks were updated (marked as canceled)
      expect(mockTasksResolver.update).toHaveBeenCalled();
      const updateCalls = mockTasksResolver.update.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);

      // Check that at least one task was marked as canceled
      const canceledTask = updateCalls.find(
        (call) => call[0].status === TaskStatus.Canceled
      );
      expect(canceledTask).toBeDefined();
    });

    it('should throw error when processIds is not an array', async () => {
      // Arrange - First create a task
      const mockTaskExtract = {
        id: 'task-extract-123',
        startedAt: new Date().toISOString()
      };
      const mockTaskClean = {
        id: 'task-clean-456',
        startedAt: new Date().toISOString()
      };

      mockTasksResolver.create
        .mockResolvedValueOnce(mockTaskExtract as never)
        .mockResolvedValueOnce(mockTaskClean as never);

      const createdTask = await tasksManager.createTask(
        mockUserId,
        mockSourceName,
        mockTotalRows
      );
      const { miningId } = createdTask;

      // Act & Assert
      await expect(
        tasksManager.deleteTask(miningId, 'invalid' as any)
      ).rejects.toThrow('processIds must be an array of strings');
    });

    it('should throw error when miningId does not exist', async () => {
      await expect(
        tasksManager.deleteTask('non-existent-id', null)
      ).rejects.toThrow('Task with mining ID non-existent-id does not exist.');
    });
  });

  describe('attachSSE', () => {
    it('should attach SSE handler to existing task', async () => {
      // Arrange - First create a task
      const mockTaskExtract = {
        id: 'task-extract-123',
        startedAt: new Date().toISOString()
      };
      const mockTaskClean = {
        id: 'task-clean-456',
        startedAt: new Date().toISOString()
      };

      mockTasksResolver.create
        .mockResolvedValueOnce(mockTaskExtract as never)
        .mockResolvedValueOnce(mockTaskClean as never);

      const createdTask = await tasksManager.createTask(
        mockUserId,
        mockSourceName,
        mockTotalRows
      );
      const { miningId } = createdTask;

      const mockReq = {} as Request;
      const mockRes = {} as Response;

      // Act
      tasksManager.attachSSE(miningId, { req: mockReq, res: mockRes });

      // Assert
      expect(mockRealtimeSSE.subscribeSSE).toHaveBeenCalledWith({
        req: mockReq,
        res: mockRes
      });
    });

    it('should throw error when miningId does not exist', () => {
      const mockReq = {} as Request;
      const mockRes = {} as Response;

      expect(() =>
        tasksManager.attachSSE('non-existent-id', {
          req: mockReq,
          res: mockRes
        })
      ).toThrow('Task with mining ID non-existent-id does not exist.');
    });
  });

  describe('constructor - Redis message handling', () => {
    it('should set up Redis subscriber on construction', () => {
      // Assert
      expect(mockRedisSubscriber.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    it('should handle valid Redis progress messages', async () => {
      // Arrange
      const messageHandler = (mockRedisSubscriber.on as jest.Mock).mock
        .calls[0][1];

      const mockTaskExtract = {
        id: 'task-extract-123',
        startedAt: new Date().toISOString()
      };
      const mockTaskClean = {
        id: 'task-clean-456',
        startedAt: new Date().toISOString()
      };

      mockTasksResolver.create
        .mockResolvedValueOnce(mockTaskExtract as never)
        .mockResolvedValueOnce(mockTaskClean as never);

      const createdTask = await tasksManager.createTask(
        mockUserId,
        mockSourceName,
        1
      );
      const { miningId } = createdTask;

      // Act - Simulate Redis message for extraction progress
      const validMessage = JSON.stringify({
        miningId,
        progressType: 'extracted',
        count: 1
      });
      await messageHandler(miningId, validMessage);

      // Assert - Progress should be updated and SSE notification sent
      expect(mockRealtimeSSE.sendSSE).toHaveBeenCalled();
    });

    it('should ignore malformed Redis messages', async () => {
      // Arrange
      const messageHandler = (mockRedisSubscriber.on as jest.Mock).mock
        .calls[0][1];

      // Act - Simulate malformed JSON
      await messageHandler('test-channel', 'invalid json');

      // Assert - Should not throw and logger.warn should be called
      expect(mockRealtimeSSE.sendSSE).not.toHaveBeenCalled();
    });

    it('should ignore incomplete Redis messages', async () => {
      // Arrange
      const messageHandler = (mockRedisSubscriber.on as jest.Mock).mock
        .calls[0][1];

      // Act - Simulate incomplete message (missing count)
      const incompleteMessage = JSON.stringify({
        miningId: 'test-mining-id',
        progressType: 'extracted'
      });
      await messageHandler('test-channel', incompleteMessage);

      // Assert
      expect(mockRealtimeSSE.sendSSE).not.toHaveBeenCalled();
    });
  });
});
