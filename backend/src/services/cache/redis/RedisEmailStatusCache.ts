import { Redis } from 'ioredis';
import { EmailStatusResult } from '../../email-status/EmailStatusVerifier';
import EmailStatusCache from '../EmailStatusCache';

export default class RedisEmailStatusCache implements EmailStatusCache {
  private readonly emailStatusKey = 'email-status';

  constructor(private readonly redisClient: Redis) {}

  async get(email: string): Promise<EmailStatusResult | null> {
    const result = await this.redisClient.hget(this.emailStatusKey, email);
    if (result !== null) {
      return JSON.parse(result) as EmailStatusResult;
    }
    return null;
  }

  async set(email: string, status: EmailStatusResult): Promise<void> {
    await this.redisClient.hset(
      this.emailStatusKey,
      email,
      JSON.stringify(status)
    );
  }

  async setMany(inputs: EmailStatusResult[]): Promise<void> {
    if (inputs.length) {
      await this.redisClient.hset(
        this.emailStatusKey,
        ...inputs.flatMap((input) => [input.email, JSON.stringify(input)])
      );
    }
  }
}
