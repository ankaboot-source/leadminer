import Redis from 'ioredis';
import EmailSignatureCache, {
  EmailSignatureWithMetadata
} from '../EmailSignatureCache';

export default class RedisEmailSignatureCache implements EmailSignatureCache {
  constructor(private readonly client: Redis) {}

  private static getKey(userId: string, email: string): string {
    return `${userId}:${email}`;
  }

  public async set(
    userId: string,
    email: string,
    signature: string,
    messageDate: string
  ): Promise<void> {
    const key = RedisEmailSignatureCache.getKey(userId, email);
    const messageDateISO = new Date(messageDate).toISOString();

    // Check if the hash exists
    const existing: Partial<EmailSignatureWithMetadata> =
      await this.client.hgetall(key);
    const isNew = !existing || Object.keys(existing).length === 0;

    const firstSeenDate = isNew
      ? messageDateISO
      : (existing.firstSeenDate ?? messageDateISO);

    await this.client.hset(key, {
      signature,
      firstSeenDate,
      lastSeenDate: messageDateISO,
      userId,
      email
    });
  }

  public async isNewer(
    userId: string,
    email: string,
    messageDate: string
  ): Promise<boolean> {
    const key = RedisEmailSignatureCache.getKey(userId, email);
    const existingDateStr = await this.client.hget(key, 'lastSeenDate');
    if (!existingDateStr) return true;
    return new Date(messageDate) > new Date(existingDateStr);
  }
}
