import { TaskStatus, TaskType, TaskCategory } from '../../../db/types';
import Task from './Task';
import { MiningTaskOptions } from './types';
import RealtimeSSE from '../../../utils/helpers/sseHelpers';
import logger from '../../../utils/logger';

export default class TaskSignature extends Task {
  readonly type: TaskType = TaskType.Signature;

  readonly category: TaskCategory = TaskCategory.Enriching;

  private signatures = 0;

  constructor(options: MiningTaskOptions, sseBroadcaster: RealtimeSSE) {
    super(options, sseBroadcaster);
  }

  async start(): Promise<void> {
    logger.info('TaskSignature started', { miningId: this.miningId });
  }

  async stop(): Promise<void> {
    this.status = TaskStatus.Canceled;
    logger.info('TaskSignature stopped', { miningId: this.miningId });
  }

  hasCompleted(): boolean {
    return (
      this.status === TaskStatus.Done || this.status === TaskStatus.Canceled
    );
  }

  public addSignatures(count: number): void {
    this.signatures += count;
    this.emitProgress({
      type: 'signatures',
      count: this.signatures
    });
  }
}
