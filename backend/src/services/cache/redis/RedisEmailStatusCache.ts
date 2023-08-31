import { Redis } from 'ioredis';
import { Status } from '../../email-status/EmailStatusVerifier';
import EmailStatusCache from '../EmailStatusCache';

export default class RedisEmailStatusCache implements EmailStatusCache {
  private readonly emailStatusKey = 'email-status';

  constructor(private readonly redisClient: Redis) {}

  get(email: string): Promise<Status | null> {
    return this.redisClient.hget(
      this.emailStatusKey,
      email
    ) as Promise<Status | null>;
  }

  async set(email: string, status: Status): Promise<void> {
    await this.redisClient.hset(this.emailStatusKey, email, status);
  }

  async setMany(inputs: { email: string; status: Status }[]): Promise<void> {
    if (inputs.length) {
      await this.redisClient.hset(
        this.emailStatusKey,
        ...inputs.flatMap(({ email, status }) => [email, status])
      );
    }
  }
}
