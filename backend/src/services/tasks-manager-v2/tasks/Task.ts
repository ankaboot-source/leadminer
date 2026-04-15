import { EventEmitter } from 'events';
import { TaskCategory, TaskStatus, TaskType } from '../types';
import type { TaskProgress, StreamPipe, ProgressMessage } from '../types';
import SupabaseTasks from '../../../db/supabase/tasks';
import logger from '../../../utils/logger';

export interface TaskConfig {
  id: string;
  type: TaskType;
  category: TaskCategory;
  miningId: string;
  userId: string;
  streams: {
    input?: StreamPipe;
    output?: StreamPipe;
  };
  config?: Record<string, unknown>;
}

export class Task extends EventEmitter {
  readonly id: string;

  readonly type: TaskType;

  readonly category: TaskCategory;

  readonly miningId: string;

  readonly userId: string;

  status: TaskStatus = TaskStatus.Running;

  progress: TaskProgress = { total: 0, processed: 0 };

  upstreamDone = false;

  streams: { input?: StreamPipe; output?: StreamPipe };

  config: Record<string, unknown>;

  startedAt?: string;

  stoppedAt?: string;

  duration?: number;

  dbId?: string;

  finishedEventName: string;

  constructor(params: TaskConfig) {
    super();
    this.id = params.id;
    this.type = params.type;
    this.category = params.category;
    this.miningId = params.miningId;
    this.userId = params.userId;
    this.streams = params.streams;
    this.config = params.config ?? {};
    this.finishedEventName =
      (params.config?.finishedEventName as string) || `${this.id}-finished`;
  }

  async start(tasksResolver: SupabaseTasks): Promise<void> {
    const record = await tasksResolver.create({
      userId: this.userId,
      type: this.type,
      category: this.category,
      status: this.status,
      details: this.toDetails() as unknown as Record<string, never>
    });

    this.dbId = record.id;
    this.startedAt = record.startedAt;
  }

  async stop(canceled = false, tasksResolver?: SupabaseTasks): Promise<void> {
    this.stoppedAt = new Date().toUTCString();
    this.status =
      canceled || this.status === TaskStatus.Canceled
        ? TaskStatus.Canceled
        : TaskStatus.Done;

    if (this.startedAt && this.stoppedAt) {
      const start = new Date(this.startedAt).getTime();
      const stop = new Date(this.stoppedAt).getTime();
      this.duration = stop - start;
    }

    if (tasksResolver && this.dbId) {
      try {
        await tasksResolver.update({
          id: this.dbId,
          userId: this.userId,
          type: this.type,
          category: this.category,
          status: this.status,
          details: this.toDetails() as unknown as Record<string, never>,
          stoppedAt: this.stoppedAt,
          startedAt: this.startedAt,
          duration: this.duration
        });
      } catch (error) {
        logger.error(`Failed to update task ${this.id} in database`, { error });
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
  onMessage(_msg: ProgressMessage): void {
    // Override in subclass
  }

  // eslint-disable-next-line class-methods-use-this
  getProgressMap(): Record<string, number> {
    return {};
  }

  isComplete(): boolean {
    if (this.status !== TaskStatus.Running) return true;
    return this.upstreamDone && this.progress.processed >= this.progress.total;
  }

  toDetails(): Record<string, unknown> {
    return {
      miningId: this.miningId,
      stream: this.streams,
      progress: this.progress,
      ...this.config
    };
  }

  protected emitProgress(key: string, value: number) {
    this.emit('progress', { key, value });
  }
}
