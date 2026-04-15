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

    this.progress.total = -1;
  }

  onMessage(msg: ProgressMessage): void {
    if (msg.progressType === 'totalSignatures') {
      this.progress.total = msg.count;
      this.emitProgress('totalSignatures', this.progress.total);
    }
    if (msg.progressType === 'signatures') {
      this.progress.processed += msg.count;
      this.emitProgress('signatures', this.progress.processed);
    }
  }

  getProgressMap(): Record<string, number> {
    return {
      signatures: this.progress.processed,
      totalSignatures: this.progress.total
    };
  }

  isComplete(): boolean {
    if (this.status !== TaskStatus.Running) return true;
    if (!this.upstreamDone || this.progress.total === -1) return false;
    return this.progress.processed >= this.progress.total;
  }
}
