import { Redis } from 'ioredis';
import { EmailSignature } from '../../../workers/email-signature/handler';
import EmailSignatureCache, {
  EmailSignatureWithMetadata
} from '../EmailSignatureCache';
import logger from '../../../utils/logger';

export default class RedisEmailSignatureCache implements EmailSignatureCache {
  private readonly signatureKeyPrefix = 'email:signature'; // For storing signatures
  private readonly miningKeyPrefix = 'mining:signature'; // For mining session tracking

  constructor(private readonly redisClient: Redis) {}

  private getEmailKey(email: string): string {
    return `${this.signatureKeyPrefix}:${email}`;
  }

  private getMiningKey(miningId: string): string {
    return `${this.miningKeyPrefix}:${miningId}`;
  }

  async getMostRecent(
    email: string
  ): Promise<EmailSignatureWithMetadata | null> {
    try {
      const signatures = await this.getHistory(email);
      if (!signatures.length) return null;

      // Return the most recent signature based on lastSeenDate
      return signatures.reduce((latest, current) =>
        current.lastSeenDate > latest.lastSeenDate ? current : latest
      );
    } catch (error) {
      logger.error('Failed to get most recent signature', {
        email,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getHistory(email: string): Promise<EmailSignatureWithMetadata[]> {
    try {
      const key = this.getEmailKey(email);
      const data = await this.redisClient.hgetall(key);

      if (!data || Object.keys(data).length === 0) {
        return [];
      }

      return Object.entries(data).map(([signatureText, metadata]) => {
        const { firstSeenDate, lastSeenDate } = JSON.parse(metadata);
        return {
          email,
          signature: signatureText,
          date: lastSeenDate,
          firstSeenDate,
          lastSeenDate
        };
      });
    } catch (error) {
      logger.error('Failed to get signature history', {
        email,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async set(
    email: string,
    signature: EmailSignature,
    messageDate: string
  ): Promise<void> {
    try {
      const key = this.getEmailKey(email);
      const existingMetadata = await this.redisClient.hget(
        key,
        signature.signature
      );

      let metadata;
      if (existingMetadata) {
        const existing = JSON.parse(existingMetadata);
        metadata = {
          firstSeenDate: existing.firstSeenDate,
          lastSeenDate:
            messageDate > existing.lastSeenDate
              ? messageDate
              : existing.lastSeenDate
        };
      } else {
        metadata = {
          firstSeenDate: messageDate,
          lastSeenDate: messageDate
        };
      }

      await this.redisClient.hset(
        key,
        signature.signature,
        JSON.stringify(metadata)
      );

      logger.debug('Signature stored/updated in cache', {
        email,
        firstSeen: metadata.firstSeenDate,
        lastSeen: metadata.lastSeenDate
      });
    } catch (error) {
      logger.error('Failed to store signature', {
        email,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getAllForMining(
    miningId: string
  ): Promise<EmailSignatureWithMetadata[]> {
    try {
      const key = this.getMiningKey(miningId);
      const emailsInMining = await this.redisClient.smembers(key);

      const signaturePromises = emailsInMining.map((email) =>
        this.getMostRecent(email)
      );

      const signatures = await Promise.all(signaturePromises);
      return signatures.filter(
        (sig): sig is EmailSignatureWithMetadata => sig !== null
      );
    } catch (error) {
      logger.error('Failed to retrieve signatures for mining', {
        miningId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async delete(email: string): Promise<void> {
    try {
      const key = this.getEmailKey(email);
      await this.redisClient.del(key);

      logger.debug('Signatures deleted from cache', { email });
    } catch (error) {
      logger.error('Failed to delete signatures', {
        email,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async hasSignature(email: string, signatureText: string): Promise<boolean> {
    try {
      const key = this.getEmailKey(email);
      return (await this.redisClient.hexists(key, signatureText)) === 1;
    } catch (error) {
      logger.error('Failed to check signature existence', {
        email,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
