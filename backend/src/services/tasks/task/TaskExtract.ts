import { TaskStatus, TaskType, TaskCategory } from '../../../db/types';
import RedisTask, { RedisTaskOptions } from './RedisTask';
import { ProgressUpdate } from './types';
import RealtimeSSE from '../../../utils/helpers/sseHelpers';
import logger from '../../../utils/logger';

export default class TaskExtract extends RedisTask {
  readonly type: TaskType = TaskType.Extract;

  readonly category: TaskCategory = TaskCategory.Mining;

  private extractedCount = 0;

  constructor(options: RedisTaskOptions, sseBroadcaster: RealtimeSSE) {
    super(options, sseBroadcaster);
  }

  async start(): Promise<void> {
    await this.createStream();
    this.subscribeToRedis();

    await this.publishMessage({
      miningId: this.miningId,
      command: 'REGISTER',
      messagesStream: this.streamName,
      messagesConsumerGroup: this.consumerGroup
    });

    logger.info('TaskExtract started', { miningId: this.miningId });
  }

  async stop(): Promise<void> {
    await super.stop();
    logger.info('TaskExtract stopped', { miningId: this.miningId });
  }

  hasCompleted(): boolean {
    return (
      this.status === TaskStatus.Done || this.status === TaskStatus.Canceled
    );
  }

  protected async handleRedisMessage(message: {
    progressType?: string;
    count?: number;
    isCompleted?: boolean;
    isCanceled?: boolean;
  }): Promise<void> {
    if (message.isCanceled) {
      this.status = TaskStatus.Canceled;
      this.emitComplete();
      return;
    }

    if (
      message.progressType === 'extracted' &&
      typeof message.count === 'number'
    ) {
      this.extractedCount = message.count;
      const update: ProgressUpdate = {
        type: 'extracted',
        count: this.extractedCount,
        isCompleted: message.isCompleted
      };
      this.emitProgress(update);

      if (message.isCompleted) {
        this.status = TaskStatus.Done;
        this.emitComplete();
      }
    }
  }
}
