import { Task } from './Task';
import { TaskType, TaskCategory, TaskStatus, TaskId } from '../types';
import type { ProgressMessage } from '../types';

export interface SignatureTaskConfig {
  id?: string;
  miningId: string;
  userId: string;
  streamName: string;
}

export class SignatureTask extends Task {
  constructor(config: SignatureTaskConfig) {
    super({
      id: config.id ?? TaskId.Signature,
      type: TaskType.Enrich,
      category: TaskCategory.Enriching,
      miningId: config.miningId,
      userId: config.userId,
      streams: {
        output: { streamName: config.streamName }
      }
    });
  }

  onMessage(msg: ProgressMessage): void {
    if (msg.progressType === 'signatures') {
      this.progress.processed += msg.count;
      this.emitProgress('signatures', this.progress.processed);
    }
    if (msg.progressType === 'signatures' && msg.isCompleted) {
      this.status = TaskStatus.Done;
    }
  }

  getProgressMap(): Record<string, number> {
    return {
      signatures: this.progress.processed
    };
  }
}
