import { Redis } from 'ioredis';
import { Request, Response } from 'express';
import { Task } from './tasks/Task';
import type {
  TaskProgress,
  MiningSource,
  ProgressMessage,
  ProgressLink,
  RedactedTask,
  TaskStreamConfig
} from './types';
import SupabaseTasks from '../../db/supabase/tasks';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';
import RealtimeSSE from '../../utils/helpers/sseHelpers';
import { mailMiningComplete, refineContacts } from '../../db/mail';
import logger from '../../utils/logger';

export interface PipelineConfig {
  miningId: string;
  userId: string;
  source: MiningSource;
  tasks: Task[];
  onComplete?: () => Promise<void>;
}

export interface PipelineDeps {
  tasksResolver: SupabaseTasks;
  redisPublisher: Redis;
  sseBroadcasterFactory: SSEBroadcasterFactory;
}

export class Pipeline {
  readonly miningId: string;

  readonly userId: string;

  readonly source: MiningSource;

  readonly tasks: Map<string, Task>;

  private progressHandlerSSE: RealtimeSSE;

  private startedAt: number;

  onComplete?: () => Promise<void>;

  public failed = false;

  private progressLinks: Map<string, ProgressLink> = new Map();

  constructor(
    private config: PipelineConfig,
    private deps: PipelineDeps
  ) {
    this.miningId = config.miningId;
    this.userId = config.userId;
    this.source = config.source;
    this.onComplete = config.onComplete;
    this.tasks = new Map(config.tasks.map((t) => [t.id, t]));
    this.progressHandlerSSE = deps.sseBroadcasterFactory.create();
    this.startedAt = performance.now();
    this.listenToTasks();
  }

  private listenToTasks() {
    for (const task of this.tasks.values()) {
      task.on('progress', (data: { key: string; value: number }) => {
        this.progressHandlerSSE.sendSSE(
          data.value,
          `${data.key}-${this.miningId}`
        );
      });
    }
  }

  addProgressLink(
    downstreamId: string,
    upstreamIds: string | string[],
    opts?: { totalFrom?: string; skipTotal?: boolean }
  ): void {
    const ids = Array.isArray(upstreamIds) ? upstreamIds : [upstreamIds];
    this.progressLinks.set(downstreamId, {
      upstreamIds: ids,
      totalFrom: opts?.totalFrom,
      skipTotal: opts?.skipTotal
    });
  }

  async start(): Promise<void> {
    const taskList = [...this.tasks.values()];
    try {
      await this.createConsumerGroups();
      await Promise.all(
        taskList.map((t) =>
          t.start(this.deps.tasksResolver, this.deps.redisPublisher)
        )
      );
    } catch (err) {
      this.failed = true;
      await this.cancel();
      throw err;
    }
  }

  private async createConsumerGroups(): Promise<void> {
    const streams = this.getStreamInfo();

    const streamDetails: { streamName: string; consumerGroup?: string }[] = [];
    for (const config of streams) {
      streamDetails.push(...config.input);
    }

    await Promise.all(
      streamDetails
        .filter((s) => s.consumerGroup)
        .map((s) =>
          this.deps.redisPublisher
            .xgroup(
              'CREATE',
              s.streamName,
              s.consumerGroup as string,
              '$',
              'MKSTREAM'
            )
            .catch((err: Error) => {
              if (!err.message.includes('BUSYGROUP')) {
                throw err;
              }
            })
        )
    );
  }

  onMessage(data: string): void {
    let msg: ProgressMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      logger.warn('Malformed Redis message', { data });
      return;
    }

    this.tasks.forEach((task) => task.onMessage(msg));

    this.propagateProgress();
    this.checkCompletion();
  }

  private propagateProgress(): void {
    for (const [downstreamId, link] of this.progressLinks) {
      const downstream = this.tasks.get(downstreamId);
      if (!downstream) continue;

      const upstreams = link.upstreamIds
        .map((id) => this.tasks.get(id))
        .filter((t): t is Task => t !== undefined);

      if (upstreams.every((u) => u.isComplete())) {
        downstream.upstreamDone = true;

        if (link.skipTotal) {
          // Don't propagate total
        } else if (link.totalFrom) {
          const progressMap = upstreams[0].getProgressMap();
          const total = progressMap[link.totalFrom];
          if (typeof total === 'number') {
            downstream.progress.total = total;
          }
        } else {
          downstream.progress.total = upstreams.reduce(
            (sum, u) => sum + u.progress.processed,
            0
          );
        }
      }
    }
  }

  private async checkCompletion(): Promise<void> {
    const tasksToStop: Task[] = [];
    for (const task of this.tasks.values()) {
      if (!task.stoppedAt && task.isComplete()) {
        tasksToStop.push(task);
      }
    }

    if (tasksToStop.length > 0) {
      for (const t of tasksToStop) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await t.stop(
            false,
            this.deps.tasksResolver,
            this.deps.redisPublisher
          );
          this.broadcastTaskFinished(t);
        } catch (err) {
          logger.error('Error stopping completed tasks', err);
        }
      }

      if (this.isAllCompleted()) {
        this.complete();
      }
    }
  }

  private isAllCompleted(): boolean {
    return [...this.tasks.values()].every((t) => t.stoppedAt != null);
  }

  private async complete(): Promise<void> {
    try {
      if (this.onComplete) {
        await this.onComplete();
      }
    } catch (err) {
      logger.error('Error in onComplete callback', err);
    }

    try {
      await this.cleanupStreams();
      if (!this.failed) {
        await refineContacts(this.userId);
        await mailMiningComplete(this.miningId);
      }
    } catch (err) {
      logger.error(
        'Failed to trigger email notification, refine contacts',
        err
      );
    } finally {
      const eventName = this.failed ? 'mining-failed' : 'mining-completed';
      this.progressHandlerSSE.sendSSE(eventName, eventName);
      this.progressHandlerSSE.stop();
    }

    const duration = performance.now() - this.startedAt;
    logger.info(
      `Mining ${this.failed ? 'failed' : 'completed'} in ${(
        duration / 1000
      ).toFixed(2)}s`,
      this.getFlattenedProgress()
    );
  }

  private async cleanupStreams(): Promise<void> {
    const streams = this.getStreamInfo();

    const streamDetails: { streamName: string; consumerGroup?: string }[] = [];
    for (const config of streams) {
      streamDetails.push(...config.input);
    }

    await Promise.all(
      streamDetails
        .filter(
          (s): s is { streamName: string; consumerGroup: string } =>
            s.consumerGroup !== undefined
        )
        .map(async (s) => {
          try {
            await this.deps.redisPublisher.xgroup(
              'DESTROY',
              s.streamName,
              s.consumerGroup
            );

            await this.deps.redisPublisher.del(s.streamName);
          } catch (err) {
            logger.error('Failed to cleanup stream', {
              streamName: s.streamName,
              error: err
            });
          }
        })
    );
  }

  private broadcastTaskFinished(task: Task): void {
    this.progressHandlerSSE.sendSSE(
      task.progress.processed,
      `${task.finishedEventName}-${this.miningId}`
    );
  }

  getFlattenedProgress(): Record<string, number> {
    const progress: Record<string, number> = {};
    for (const task of this.tasks.values()) {
      Object.assign(progress, task.getProgressMap());
    }
    return progress;
  }

  getAggregatedProgress(): Record<string, TaskProgress> {
    const progress: Record<string, TaskProgress> = {};
    for (const [id, task] of this.tasks) {
      progress[id] = {
        total: task.progress.total,
        processed: task.progress.processed
      };
    }
    return progress;
  }

  getTask<T extends Task>(taskId: string): T | undefined {
    return this.tasks.get(taskId) as T | undefined;
  }

  getActiveTask(): RedactedTask {
    const processes: Record<string, string | undefined> = {};
    for (const [id, task] of this.tasks) {
      processes[id] = task.dbId;
    }
    return {
      userId: this.userId,
      miningId: this.miningId,
      miningSource: this.source,
      processes,
      progress: this.getFlattenedProgress()
    };
  }

  attachSSE(connection: { req: Request; res: Response }): void {
    this.progressHandlerSSE.subscribeSSE(connection);
  }

  getTaskStreams(taskId: string): TaskStreamConfig | undefined {
    const task = this.tasks.get(taskId);
    return task?.streams;
  }

  getStreamInfo(): TaskStreamConfig[] {
    const streams: TaskStreamConfig[] = [];

    for (const task of this.tasks.values()) {
      if (!task.streams) continue;
      streams.push(task.streams);
    }

    return streams;
  }

  async cancel(processIds?: string[]): Promise<RedactedTask> {
    if (processIds && !Array.isArray(processIds)) {
      throw new Error('processIds must be an array of strings');
    }

    const endEntireTask = !processIds || processIds.length === 0;
    const tasksToStop = [...this.tasks.values()].filter((t) => {
      if (t.stoppedAt) return false;
      if (endEntireTask) return true;
      if (!t.dbId) return false;
      return (processIds as string[]).includes(t.dbId);
    });

    if (tasksToStop.length) {
      // eslint-disable-next-line no-await-in-loop
      for (const t of tasksToStop) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await t.stop(true, this.deps.tasksResolver, this.deps.redisPublisher);
          this.propagateProgress();
          this.broadcastTaskFinished(t);
        } catch (err) {
          logger.error(`Failed to stop task ${t.id ?? 'unknown'}`, err);
        }
      }
    }

    if (this.isAllCompleted()) {
      await this.complete();
    }

    return this.getActiveTask();
  }
}
