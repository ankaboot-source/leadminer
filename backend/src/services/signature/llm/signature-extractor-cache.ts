import { createHash } from 'crypto';
import Redis from 'ioredis';
import { ExtractSignature, PersonLD } from '../types';

export class SignatureExtractorCache implements ExtractSignature {
  private static readonly CACHE_PREFIX = 'llm-sig:';
  private static readonly DEFAULT_TTL = 86400;

  constructor(
    private readonly wrapped: ExtractSignature,
    private readonly redis: Redis,
    private readonly ttlSeconds: number = SignatureExtractorCache.DEFAULT_TTL
  ) {}

  isActive(): boolean {
    return this.wrapped.isActive();
  }

  private hashSignature(signature: string): string {
    return createHash('sha256').update(signature).digest('hex');
  }

  private cacheKey(signature: string): string {
    return `${SignatureExtractorCache.CACHE_PREFIX}${this.hashSignature(signature)}`;
  }

  async extract(email: string, signature: string): Promise<PersonLD | null> {
    const key = this.cacheKey(signature);

    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.wrapped.extract(email, signature);

    if (result) {
      await this.redis.setex(key, this.ttlSeconds, JSON.stringify(result));
    }

    return result;
  }
}
