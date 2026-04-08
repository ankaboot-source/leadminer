import { Request, Response } from 'express';
import { TaskStatus, TaskType, TaskCategory } from '../../../db/types';

export type MiningSourceType = 'email' | 'file' | 'pst';

export interface TaskProgress {
  total: number;
  processed: number;
}

export interface ProgressUpdate {
  type: string;
  count: number;
  isCompleted?: boolean;
  isCanceled?: boolean;
}

export interface MiningTaskOptions {
  miningId: string;
  userId: string;
}

export interface MiningTask {
  readonly type: TaskType;
  readonly category: TaskCategory;
  status: TaskStatus;
  progress: TaskProgress;

  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  hasCompleted(): boolean;

  // Events
  onProgress(callback: (update: ProgressUpdate) => void): void;
  onComplete(callback: () => void): void;
  onError(callback: (error: Error) => void): void;

  // SSE
  attachSSE(connection: { req: Request; res: Response }): void;
}
