import { JobsOptions, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { EmailVerificationJobData } from './types';

export default class EmailVerificationQueue {
  private readonly queue: Queue<EmailVerificationJobData, void, string>;

  private readonly jobOptions: JobsOptions = {
    removeOnComplete: true,
    removeOnFail: true
  };

  constructor(redisClient: Redis, queueName: string) {
    this.queue = new Queue(queueName, { connection: redisClient });
  }

  async addSingle(data: EmailVerificationJobData) {
    return this.queue.add(data.email, data, this.jobOptions);
  }

  async addMany(data: EmailVerificationJobData[]) {
    if (data.length) {
      return this.queue.addBulk(
        data.map((d) => ({
          name: d.userId,
          data: {
            ...d
          },
          jobOptions: this.jobOptions
        }))
      );
    }

    return Promise.resolve();
  }
}
