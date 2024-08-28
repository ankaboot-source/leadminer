import { Redis } from 'ioredis';
import QueuedEmailsCache from '../QueuedEmailsCache';

export default class RedisQueuedEmailsCache implements QueuedEmailsCache {
  constructor(
    private readonly redisClient: Redis,
    private readonly key: string
  ) {}

  async destroy(): Promise<void> {
    await this.redisClient.del(this.key);
  }

  /**
   * Adds a new email.
   * @param email - The email to be added.
   * @returns `true` if the email was successfully added, or `false` if the email already exists.
   */
  async add(email: string): Promise<boolean> {
    const result = await this.redisClient.zadd(
      this.key,
      'NX',
      Date.now(),
      email
    );
    return result === 1;
  }

  async addMany(emails: string[]) {
    const addedElements: string[] = [];
    const rejectedElements: string[] = [];

    for (const email of emails) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.add(email);
      if (result) {
        addedElements.push(email);
      } else {
        rejectedElements.push(email);
      }
    }
    return { addedElements, rejectedElements };
  }

  async has(email: string): Promise<boolean> {
    const isMember = await this.redisClient.zscore(this.key, email);
    return isMember !== null;
  }
}
