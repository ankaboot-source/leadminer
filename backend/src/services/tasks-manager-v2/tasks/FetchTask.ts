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
  passive_mining?: boolean;
  sourceId?: string;
}

export class FetchTask extends Task {
  private fetcherClient: FetcherClient;

  private detailsCursor: unknown;

  constructor(config: FetchTaskConfig) {
    super({
      id: config.id ?? TaskId.Fetch,
      type: TaskType.Fetch,
      category: TaskCategory.Mining,
      miningId: config.miningId,
      userId: config.userId,
      streams: undefined,
      config: {
        extractSignatures: config.extractSignatures,
        signatureStream: config.signatureStream,
        fetchParams: config.fetchParams,
        outputStream: config.outputStream,
        ...(config.sourceId ? { sourceId: config.sourceId } : {})
      },
      passive_mining: config.passive_mining
    });
    this.fetcherClient = config.fetcherClient;
    this.upstreamDone = true;
  }

  async start(tasksResolver: SupabaseTasks): Promise<void> {
    await super.start(tasksResolver);

    try {
      const result = await this.fetcherClient.startFetch({
        miningId: this.miningId,
        contactStream: this.config.outputStream as string,
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
            details: this.toDetails() as unknown as Record<string, never>
          });
        } catch {
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
    }
    if (msg.progressType === 'fetched' && (msg.isCompleted || msg.isCanceled)) {
      this.status = msg.isCanceled ? TaskStatus.Canceled : TaskStatus.Done;

      // Capture the fetcher's UID watermark (present on the final message)
      // so the pipeline can persist it to the mining source on completion.
      // Only trusted if the run actually completed; a canceled run's cursor
      // would mark messages as mined before they were extracted/cleaned.
      const { watermark } = msg as ProgressMessage & { watermark?: unknown };
      if (watermark && !msg.isCanceled) {
        this.detailsCursor = watermark;
      }
    }
  }

  /**
   * Persist the watermark captured from the fetcher's final message into the
   * task row. The completion edge function reads it from here when extraction
   * succeeds, decoupling source writes from this service.
   */
  toDetails(): Record<string, unknown> {
    return {
      ...super.toDetails(),
      ...(this.detailsCursor ? { watermark: this.detailsCursor } : {})
    };
  }

  isComplete(): boolean {
    return this.status !== TaskStatus.Running;
  }

  getProgressMap(): Record<string, number> {
    return {
      fetched: this.progress.processed,
      totalMessages: this.progress.total
    };
  }
}
