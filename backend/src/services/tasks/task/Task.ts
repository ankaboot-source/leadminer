import { Request, Response } from 'express';
import { TaskStatus, TaskType, TaskCategory } from '../../../db/types';
import {
  MiningTask,
  TaskProgress,
  ProgressUpdate,
  MiningTaskOptions
} from './types';
import RealtimeSSE from '../../../utils/helpers/sseHelpers';
import logger from '../../../utils/logger';

export default abstract class Task implements MiningTask {
  abstract readonly type: TaskType;

  abstract readonly category: TaskCategory;

  public status: TaskStatus = TaskStatus.Running;

  public progress: TaskProgress = { total: 0, processed: 0 };

  private readonly progressCallbacks: ((update: ProgressUpdate) => void)[] = [];

  private readonly completeCallbacks: (() => void)[] = [];

  private readonly errorCallbacks: ((error: Error) => void)[] = [];

  protected readonly miningId: string;

  protected readonly userId: string;

  protected sseBroadcaster: RealtimeSSE;

  constructor(options: MiningTaskOptions, sseBroadcaster: RealtimeSSE) {
    this.miningId = options.miningId;
    this.userId = options.userId;
    this.sseBroadcaster = sseBroadcaster;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract hasCompleted(): boolean;

  onProgress(callback: (update: ProgressUpdate) => void): void {
    this.progressCallbacks.push(callback);
  }

  onComplete(callback: () => void): void {
    this.completeCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  attachSSE(connection: { req: Request; res: Response }): void {
    this.sseBroadcaster.subscribeSSE(connection);
  }

  protected emitProgress(update: ProgressUpdate): void {
    this.progress = {
      ...this.progress,
      processed: update.count
    };
    this.progressCallbacks.forEach((cb) => cb(update));
    this.sseBroadcaster.sendSSE(
      { miningId: this.miningId, ...update },
      this.type
    );
  }

  protected emitComplete(): void {
    this.status = TaskStatus.Done;
    this.completeCallbacks.forEach((cb) => cb());
  }

  protected emitError(error: Error): void {
    logger.error(`Task ${this.type} error for mining ${this.miningId}`, {
      error
    });
    this.errorCallbacks.forEach((cb) => cb(error));
  }
}
