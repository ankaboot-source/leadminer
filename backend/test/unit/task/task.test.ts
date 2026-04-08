import { describe, it, expect, beforeEach } from '@jest/globals';
import Task from '../../../src/services/tasks/task/Task';
import { TaskStatus } from '../../../src/db/types';

class ConcreteTask extends Task {
  readonly type = 'test' as const;

  readonly category = 'mining' as const;

  async start() {}

  async stop() {}

  hasCompleted() {
    return this.status === TaskStatus.Done;
  }
}

describe('Task', () => {
  let task: ConcreteTask;

  beforeEach(() => {
    task = new ConcreteTask(
      { miningId: 'test-id', userId: 'user-1' },
      {} as any
    );
  });

  it('should initialize with running status', () => {
    expect(task.status).toBe(TaskStatus.Running);
  });

  it('should emit progress updates', () => {
    const progressCallback = jest.fn();
    task.onProgress(progressCallback);

    task.emitProgress({ type: 'test', count: 5 });

    expect(progressCallback).toHaveBeenCalledWith({ type: 'test', count: 5 });
    expect(task.progress.processed).toBe(5);
  });

  it('should emit completion', () => {
    const completeCallback = jest.fn();
    task.onComplete(completeCallback);

    task.emitComplete();

    expect(completeCallback).toHaveBeenCalled();
    expect(task.status).toBe(TaskStatus.Done);
  });
});
