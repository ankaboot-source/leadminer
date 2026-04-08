import { TaskStatus, TaskType, TaskCategory } from '../../../db/types';
import Task from './Task';
import { MiningTaskOptions, ProgressUpdate } from './types';
import {
  FetcherAdapter,
  FetchStartPayload,
  FetchStopPayload
} from '../fetcher/FetcherAdapter';
import RealtimeSSE from '../../../utils/helpers/sseHelpers';
import logger from '../../../utils/logger';

export interface TaskFetchOptions extends MiningTaskOptions {
  fetchers: FetcherAdapter[];
  contactStream: string;
  signatureStream: string;
  extractSignatures: boolean;
}

export default class TaskFetch extends Task {
  readonly type: TaskType = TaskType.Fetch;

  readonly category: TaskCategory = TaskCategory.Mining;

  private readonly fetchers: FetcherAdapter[];

  private readonly contactStream: string;

  private readonly signatureStream: string;

  private readonly extractSignatures: boolean;

  private totalMessages = 0;

  private fetchedCount = 0;

  constructor(options: TaskFetchOptions, sseBroadcaster: RealtimeSSE) {
    super(options, sseBroadcaster);
    this.fetchers = options.fetchers;
    this.contactStream = options.contactStream;
    this.signatureStream = options.signatureStream;
    this.extractSignatures = options.extractSignatures;
  }

  async start(): Promise<void> {
    const payload: FetchStartPayload = {
      userId: this.userId,
      miningId: this.miningId,
      contactStream: this.contactStream,
      signatureStream: this.signatureStream,
      extractSignatures: this.extractSignatures
    };

    for (const fetcher of this.fetchers) {
      try {
        const result = await fetcher.start(payload);
        this.totalMessages += result.totalMessages;

        fetcher.onComplete = () => {
          this.fetchedCount++;
          this.emitProgress({
            type: 'fetched',
            count: this.fetchedCount
          });

          if (this.hasCompleted()) {
            this.status = TaskStatus.Done;
            this.emitComplete();
          }
        };
      } catch (error) {
        logger.error(`Fetcher ${fetcher.sourceType} failed to start`, {
          error
        });
        this.emitError(error as Error);
      }
    }

    logger.info('TaskFetch started', {
      miningId: this.miningId,
      fetchers: this.fetchers.map((f) => f.sourceType)
    });
  }

  async stop(): Promise<void> {
    const stopPayload: FetchStopPayload = {
      miningId: this.miningId,
      canceled: true
    };

    await Promise.all(this.fetchers.map((f) => f.stop(stopPayload)));

    this.status = TaskStatus.Canceled;
    logger.info('TaskFetch stopped', { miningId: this.miningId });
  }

  hasCompleted(): boolean {
    return this.fetchers.every((f) => f.isCompleted);
  }
}
