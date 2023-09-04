import { JobsOptions, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { EmailVerificationJobData } from './types';

interface Options {
  COMPLETED_JOBS_MAX_AGE_MINUTES: number;
  COMPLETED_JOBS_MAX_COUNT: number;
  EMAIL_VERIFICATION_QUEUE_NAME: string;
}

export default class EmailVerificationQueue {
  private readonly queue: Queue<EmailVerificationJobData, void, string>;

  private readonly jobOptions: JobsOptions;

  constructor(
    redisClient: Redis,
    {
      EMAIL_VERIFICATION_QUEUE_NAME,
      COMPLETED_JOBS_MAX_AGE_MINUTES,
      COMPLETED_JOBS_MAX_COUNT
    }: Options
  ) {
    this.jobOptions = {
      removeOnComplete: {
        count: COMPLETED_JOBS_MAX_COUNT,
        age: COMPLETED_JOBS_MAX_AGE_MINUTES * 60
      },
      removeOnFail: true
    };
    this.queue = new Queue(EMAIL_VERIFICATION_QUEUE_NAME, {
      connection: redisClient,
      defaultJobOptions: this.jobOptions
    });
  }

  addSingle({ email, userId }: EmailVerificationJobData) {
    return this.queue.add(
      email,
      { email, userId },
      {
        jobId: email // By setting the email as the jobId, we ensure that each email is added once and only once to the queue, unless it was cleared
      }
    );
  }

  addMany(data: EmailVerificationJobData[]) {
    if (data.length > 0) {
      return this.queue.addBulk(
        data.map(({ email, userId }) => ({
          name: userId,
          data: {
            email,
            userId
          },
          opts: {
            jobId: email // By setting the email as the jobId, we ensure that each email is added once and only once to the queue, unless it was cleared
          }
        }))
      );
    }

    return Promise.resolve();
  }
}
