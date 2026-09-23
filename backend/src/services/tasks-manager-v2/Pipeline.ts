import { Redis } from 'ioredis';
import { Request, Response } from 'express';
import { Task } from './tasks/Task';
import { TaskStatus, TaskType } from './types';
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
import { recordMiningCompletion } from '../../db/completion';
import logger from '../../utils/logger';
import { errorMeta } from '../../utils/errors';

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

  private completionStarted = false;

  /**
   * Guards the one-shot completion callback. It fires when the Extract task
   * succeeds, which can happen before optional enriching tasks (signature) or
   * the optional cleaning step, so it must never run twice.
   */
  private completionRecorded = false;

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
      for (const t of taskList) {
        // eslint-disable-next-line no-await-in-loop
        await t.start(this.deps.tasksResolver, this.deps.redisPublisher);
      }
    } catch (err) {
      this.failed = true;
      await this.cancel(); // clean up all tasks (including those already started)
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
      // Log shape only: the raw payload may carry customer data.
      logger.warn('Malformed Redis message', {
        miningId: this.miningId,
        length: data.length
      });
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
    if (this.completionStarted) return;

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
          logger.error('Error stopping completed tasks', {
            error: errorMeta(err)
          });
        }
      }

      // The Extract task succeeding is the durable signal that messages were
      // actually processed (clean and signature are optional). Record the run
      // on the mining source via the completion edge function.
      await this.maybeRecordMiningCompletion();

      if (this.isAllCompleted() && !this.completionStarted) {
        this.completionStarted = true;
        await this.complete();
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
      logger.error('Error in onComplete callback', {
        error: errorMeta(err)
      });
    }

    try {
      await this.cleanupStreams();
      if (!this.failed) {
        // Notification/refinement are best-effort and independent of the
        // watermark, which the completion edge function already persisted when
        // extraction succeeded.
        await refineContacts(this.userId);
        await mailMiningComplete(this.miningId);
      }
    } catch (err) {
      // Refine (or the completion email) failed after mining completed. The
      // email reads refined stats, so a failure here leaves them stale.
      logger.error('Refine contacts / completion email failed', {
        miningId: this.miningId,
        userId: this.userId,
        error: (err as Error).message
      });
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
              error: errorMeta(err)
            });
          }
        })
    );
  }

  /**
   * Triggers the completion edge function once the Extract task has succeeded.
   *
   * The watermark itself lives in the Fetch task's DB row (FetchTask.toDetails)
   * and the edge function reads it from there, so this only has to fire the
   * command. Cleaning and signature extraction are optional post-processing and
   * must not influence whether the run is recorded. A canceled extraction (or
   * fetch) leaves the status at Canceled, so nothing is recorded and the next
   * cycle re-fetches — at-least-once.
   */
  private async maybeRecordMiningCompletion(): Promise<void> {
    if (this.completionRecorded || this.failed) return;

    const extractTask = [...this.tasks.values()].find(
      (t) => t.type === TaskType.Extract
    );
    if (!extractTask || extractTask.status !== TaskStatus.Done) return;

    this.completionRecorded = true;
    try {
      await recordMiningCompletion(this.miningId);
    } catch (err) {
      logger.error(
        `[mining-completion] Failed to record completion for ${this.miningId}`,
        { error: err }
      );
    }
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
          logger.error(`Failed to stop task ${t.id ?? 'unknown'}`, {
            error: errorMeta(err)
          });
        }
      }
    }

    if (this.isAllCompleted() && !this.completionStarted) {
      this.completionStarted = true;
      await this.complete();
    }

    return this.getActiveTask();
  }
}
