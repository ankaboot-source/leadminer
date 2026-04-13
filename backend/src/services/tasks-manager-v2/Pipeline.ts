import { Redis } from 'ioredis';
import { Request, Response } from 'express';
import { Task } from './tasks/Task';
import type {
  TaskProgress,
  MiningSource,
  ProgressMessage,
  ProgressLink,
  RedactedTask,
  StreamInfo,
  StreamCommand,
  StreamRole
} from './types';
import SupabaseTasks from '../../db/supabase/tasks';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';
import RealtimeSSE from '../../utils/helpers/sseHelpers';
import { mailMiningComplete, refineContacts } from '../../db/mail';
import logger from '../../utils/logger';
import ENV from '../../config';

export interface PipelineConfig {
  miningId: string;
  userId: string;
  source: MiningSource;
  tasks: Task[];
  onComplete?: () => Promise<void>;
  passiveMining?: boolean;
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

  readonly passiveMining: boolean;

  private progressHandlerSSE: RealtimeSSE;

  private startedAt: number;

  onComplete?: () => Promise<void>;

  private progressLinks: Map<string, ProgressLink> = new Map();

  constructor(
    private config: PipelineConfig,
    private deps: PipelineDeps
  ) {
    this.miningId = config.miningId;
    this.userId = config.userId;
    this.source = config.source;
    this.onComplete = config.onComplete;
    this.passiveMining = config.passiveMining ?? false;
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
    await Promise.all(taskList.map((t) => t.start(this.deps.tasksResolver)));

    await this.registerStreams();
  }

  private async registerStreams(): Promise<void> {
    const streams = this.getStreamInfo();

    await Promise.all(
      streams
        .filter((stream) => stream.consumerGroup)
        .map((stream) =>
          this.deps.redisPublisher.xgroup(
            'CREATE',
            stream.streamName,
            stream.consumerGroup as string,
            '$',
            'MKSTREAM'
          )
        )
    );

    await this.deps.redisPublisher.publish(
      ENV.REDIS_PUBSUB_COMMUNICATION_CHANNEL,
      JSON.stringify({
        miningId: this.miningId,
        command: 'REGISTER',
        streams
      } as StreamCommand)
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

  private checkCompletion(): void {
    const tasksToStop: Task[] = [];
    for (const task of this.tasks.values()) {
      if (!task.stoppedAt && task.isComplete()) {
        tasksToStop.push(task);
      }
    }

    if (tasksToStop.length > 0) {
      Promise.all(
        tasksToStop.map((t) => t.stop(false, this.deps.tasksResolver))
      )
        .then(() => {
          tasksToStop.forEach((t) => this.broadcastTaskFinished(t));

          if (this.isAllCompleted()) {
            this.complete();
          }
        })
        .catch((err) => {
          logger.error('Error stopping completed tasks', err);
        });
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
      await refineContacts(this.userId);
      await mailMiningComplete(this.miningId);
    } catch (err) {
      logger.error(
        'Failed to trigger email notification, refine contacts',
        err
      );
    } finally {
      this.progressHandlerSSE.sendSSE('mining-completed', 'mining-completed');
      this.progressHandlerSSE.stop();
    }

    const duration = performance.now() - this.startedAt;
    logger.info(
      `Mining completed in ${(duration / 1000).toFixed(2)}s`,
      this.getFlattenedProgress()
    );
  }

  private async cleanupStreams(): Promise<void> {
    const streams = this.getStreamInfo();

    await Promise.all(
      streams
        .filter(
          (stream): stream is StreamInfo & { consumerGroup: string } =>
            stream.consumerGroup !== undefined
        )
        .map(async (stream) => {
          try {
            await this.deps.redisPublisher.xgroup(
              'DESTROY',
              stream.streamName,
              stream.consumerGroup
            );

            await this.deps.redisPublisher.del(stream.streamName);
          } catch (err) {
            logger.error('Failed to cleanup stream', {
              streamName: stream.streamName,
              error: err
            });
          }
        })
    );
    await this.deps.redisPublisher.publish(
      ENV.REDIS_PUBSUB_COMMUNICATION_CHANNEL,
      JSON.stringify({
        miningId: this.miningId,
        command: 'DELETE',
        streams
      } as StreamCommand)
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

  getTaskStreams(taskId: string):
    | {
        input?: { streamName: string; consumerGroup?: string };
        output?: { streamName: string; consumerGroup?: string };
      }
    | undefined {
    const task = this.tasks.get(taskId);
    return task?.streams;
  }

  getStreamInfo(): StreamInfo[] {
    const streams: StreamInfo[] = [];

    for (const task of this.tasks.values()) {
      if (task.streams.input?.consumerGroup && task.streams.input.role) {
        streams.push({
          streamName: task.streams.input.streamName,
          consumerGroup: task.streams.input.consumerGroup,
          role: task.streams.input.role as StreamRole
        });
      }
      if (task.streams.output?.consumerGroup && task.streams.output.role) {
        streams.push({
          streamName: task.streams.output.streamName,
          consumerGroup: task.streams.output.consumerGroup,
          role: task.streams.output.role as StreamRole
        });
      }
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
      await Promise.all(
        tasksToStop.map((t) => t.stop(true, this.deps.tasksResolver))
      );
    }

    if (this.isAllCompleted()) {
      await this.complete();
    }

    return this.getActiveTask();
  }
}
