import { Task } from './Task';
import { TaskType, TaskCategory, TaskId } from '../types';
import type { ProgressMessage, TaskStreamConfig } from '../types';

export interface CleanTaskConfig {
  id?: string;
  miningId: string;
  userId: string;
  streams: TaskStreamConfig;
  passive_mining?: boolean;
}

export class CleanTask extends Task {
  constructor(config: CleanTaskConfig) {
    super({
      id: config.id ?? TaskId.Clean,
      type: TaskType.Clean,
      category: TaskCategory.Cleaning,
      miningId: config.miningId,
      userId: config.userId,
      streams: config.streams,
      passive_mining: config.passive_mining
    });
  }

  onMessage(msg: ProgressMessage): void {
    if (msg.progressType === 'verifiedContacts') {
      this.progress.processed += msg.count;
      this.emitProgress('verifiedContacts', this.progress.processed);
    }
  }

  getProgressMap(): Record<string, number> {
    return {
      verifiedContacts: this.progress.processed
    };
  }
}
