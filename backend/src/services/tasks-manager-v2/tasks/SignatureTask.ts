import { Task } from './Task';
import { TaskType, TaskCategory, TaskStatus, TaskId } from '../types';
import type { ProgressMessage, TaskStreamConfig } from '../types';

export interface SignatureTaskConfig {
  id?: string;
  miningId: string;
  userId: string;
  streams: TaskStreamConfig;
  passive_mining?: boolean;
}

export class SignatureTask extends Task {
  constructor(config: SignatureTaskConfig) {
    super({
      id: config.id ?? TaskId.Signature,
      type: TaskType.Enrich,
      // Signature extraction is a mining phase, not a user-initiated
      // enrichment: it runs inside the mining pipeline, mines a fixed set of
      // already-known contacts and enriches nothing. Filing it under
      // 'enriching' made the frontend enrichment store adopt it as the user's
      // running enrichment task (it filters on category alone), which spun the
      // Enrich button for the whole mining run.
      category: TaskCategory.Mining,
      miningId: config.miningId,
      userId: config.userId,
      streams: config.streams,
      passive_mining: config.passive_mining
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
