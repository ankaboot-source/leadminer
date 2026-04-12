import { Task } from './Task';
import { TaskType, TaskCategory, TaskStatus, TaskId } from '../types';
import type { ProgressMessage } from '../types';
import SupabaseTasks from '../../../db/supabase/tasks';

export interface FetcherClient {
  startFetch(opts: {
    miningId: string;
    contactStream: string;
    signatureStream?: string;
    extractSignatures?: boolean;
    userId: string;
    fetchParams?: Record<string, unknown>;
  }): Promise<{ data: { totalMessages: number } }>;
  stopFetch(opts: { miningId: string; canceled: boolean }): Promise<void>;
}

export interface FetchTaskConfig {
  id?: string;
  miningId: string;
  userId: string;
  outputStream: string;
  fetcherClient: FetcherClient;
  extractSignatures?: boolean;
  signatureStream?: string;
  fetchParams?: Record<string, unknown>;
  passiveMining?: boolean;
}

export class FetchTask extends Task {
  private fetcherClient: FetcherClient;

  constructor(config: FetchTaskConfig) {
    super({
      id: config.id ?? TaskId.Fetch,
      type: TaskType.Fetch,
      category: TaskCategory.Mining,
      miningId: config.miningId,
      userId: config.userId,
      streams: { output: { streamName: config.outputStream } },
      config: {
        extractSignatures: config.extractSignatures,
        signatureStream: config.signatureStream,
        fetchParams: config.fetchParams,
        passiveMining: config.passiveMining
      }
    });
    this.fetcherClient = config.fetcherClient;
    this.upstreamDone = true;
  }

  async start(tasksResolver: SupabaseTasks): Promise<void> {
    await super.start(tasksResolver);

    try {
      const result = await this.fetcherClient.startFetch({
        miningId: this.miningId,
        contactStream: this.streams.output!.streamName,
        signatureStream: this.config.signatureStream as string,
        extractSignatures: this.config.extractSignatures as boolean,
        userId: this.userId,
        fetchParams: this.config.fetchParams as Record<string, unknown>
      });

      this.progress.total = result.data.totalMessages;
    } catch (error) {
      this.status = TaskStatus.Canceled;
      this.stoppedAt = new Date().toUTCString();
      if (this.dbId) {
        try {
          await tasksResolver.update({
            id: this.dbId,
            userId: this.userId,
            type: this.type,
            category: this.category,
            status: this.status,
            details: this.toDetails()
          } as any);
        } catch (updateError) {
          // Best effort — the main error is the fetcher failure
        }
      }
      throw error;
    }
  }

  async stop(canceled = false, tasksResolver?: SupabaseTasks): Promise<void> {
    await super.stop(canceled, tasksResolver);
    await this.fetcherClient.stopFetch({
      miningId: this.miningId,
      canceled
    });
  }

  onMessage(msg: ProgressMessage): void {
    if (msg.progressType === 'totalMessages') {
      this.progress.total = msg.count;
      this.emitProgress('totalMessages', this.progress.total);
    }
    if (msg.progressType === 'fetched') {
      this.progress.processed += msg.count;
      this.emitProgress('fetched', this.progress.processed);
      if (msg.isCompleted || msg.isCanceled) {
        this.status = msg.isCanceled ? TaskStatus.Canceled : TaskStatus.Done;
      }
    }
  }

  getProgressMap(): Record<string, number> {
    return {
      fetched: this.progress.processed,
      totalMessages: this.progress.total
    };
  }
}
