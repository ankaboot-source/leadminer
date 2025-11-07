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
    messageId: string,
    messageDate: string,
    miningId: string
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
      messageId,
      userId,
      email
    });

    await this.client.sadd(`mining:${miningId}`, key);
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

  public async getAllFromMining(
    miningId: string
  ): Promise<EmailSignatureWithMetadata[]> {
    const miningKey = `mining:${miningId}`;
    const signatureKeys = await this.client.smembers(miningKey);

    if (signatureKeys.length === 0) {
      return [];
    }

    const pipeline = this.client.pipeline();
    signatureKeys.forEach((key) => pipeline.hgetall(key));

    const results = (await pipeline.exec()) as [
      Error,
      EmailSignatureWithMetadata
    ][];

    if (!results?.length) return [];

    return results.map(([err, data]) => {
      if (err) throw err;
      return {
        signature: data.signature,
        firstSeenDate: data.firstSeenDate,
        lastSeenDate: data.lastSeenDate,
        messageId: data.messageId,
        userId: data.userId,
        email: data.email
      };
    });
  }

  public async clearCachedSignature(miningId: string): Promise<void> {
    const miningKey = `mining:${miningId}`;

    const signatureKeys = await this.client.smembers(miningKey);

    if (signatureKeys.length > 0) {
      const pipeline = this.client.pipeline();

      pipeline.del(...signatureKeys);
      pipeline.del(miningKey);

      await pipeline.exec();
    } else {
      await this.client.del(miningKey);
    }
  }
}
