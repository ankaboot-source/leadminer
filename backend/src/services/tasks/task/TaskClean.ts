import { TaskStatus, TaskType, TaskCategory } from '../../../db/types';
import RedisTask, { RedisTaskOptions } from './RedisTask';
import { ProgressUpdate } from './types';
import RealtimeSSE from '../../../utils/helpers/sseHelpers';
import logger from '../../../utils/logger';

export default class TaskClean extends RedisTask {
  readonly type: TaskType = TaskType.Clean;

  readonly category: TaskCategory = TaskCategory.Cleaning;

  private verifiedContacts = 0;

  private createdContacts = 0;

  constructor(options: RedisTaskOptions, sseBroadcaster: RealtimeSSE) {
    super(options, sseBroadcaster);
  }

  async start(): Promise<void> {
    await this.createStream();
    this.subscribeToRedis();

    await this.publishMessage({
      miningId: this.miningId,
      command: 'REGISTER',
      emailsStream: this.streamName,
      emailsConsumerGroup: this.consumerGroup
    });

    logger.info('TaskClean started', { miningId: this.miningId });
  }

  async stop(): Promise<void> {
    await super.stop();
    logger.info('TaskClean stopped', { miningId: this.miningId });
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
      message.progressType === 'createdContacts' &&
      typeof message.count === 'number'
    ) {
      this.createdContacts = message.count;
      this.emitProgress({
        type: 'createdContacts',
        count: this.createdContacts,
        isCompleted: message.isCompleted
      });
    }

    if (
      message.progressType === 'verifiedContacts' &&
      typeof message.count === 'number'
    ) {
      this.verifiedContacts = message.count;
      this.emitProgress({
        type: 'verifiedContacts',
        count: this.verifiedContacts,
        isCompleted: message.isCompleted
      });
    }

    if (message.isCompleted) {
      this.status = TaskStatus.Done;
      this.emitComplete();
    }
  }
}
