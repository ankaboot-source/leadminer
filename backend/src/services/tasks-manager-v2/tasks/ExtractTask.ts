import { Task } from './Task';
import { TaskType, TaskCategory, TaskId } from '../types';
import type { ProgressMessage, StreamPipe } from '../types';

export interface ExtractTaskConfig {
  id?: string;
  miningId: string;
  userId: string;
  inputStream: StreamPipe;
  outputStream: StreamPipe;
}

export class ExtractTask extends Task {
  private createdContactsCount = 0;

  get createdContactCount(): number {
    return this.createdContactsCount;
  }

  addCreatedContacts(count: number): void {
    this.createdContactsCount += count;
    this.emitProgress('createdContacts', this.createdContactCount);
  }

  constructor(config: ExtractTaskConfig) {
    super({
      id: config.id ?? TaskId.Extract,
      type: TaskType.Extract,
      category: TaskCategory.Mining,
      miningId: config.miningId,
      userId: config.userId,
      streams: {
        input: config.inputStream,
        output: config.outputStream
      }
    });
  }

  onMessage(msg: ProgressMessage): void {
    if (msg.progressType === 'extracted') {
      this.progress.processed += msg.count;
      this.emitProgress('extracted', this.progress.processed);
    }
    if (msg.progressType === 'createdContacts') {
      this.addCreatedContacts(msg.count);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  getProgressMap(): Record<string, number> {
    return {
      extracted: this.progress.processed,
      createdContacts: this.createdContactCount
    };
  }
}
