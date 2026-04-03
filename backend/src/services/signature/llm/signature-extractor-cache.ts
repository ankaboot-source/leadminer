import { createHash } from 'crypto';
import Redis from 'ioredis';
import { Logger } from 'winston';
import { ExtractSignature, PersonLD } from '../types';

export default class SignatureExtractorCache implements ExtractSignature {
  private static readonly CACHE_PREFIX = 'llm-sig:';

  private static readonly DEFAULT_TTL = 86400;

  constructor(
    private readonly wrapped: ExtractSignature,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly ttlSeconds: number = SignatureExtractorCache.DEFAULT_TTL
  ) {}

  isActive(): boolean {
    return this.wrapped.isActive();
  }

  get wrappedEngineName(): string {
    return this.wrapped.constructor.name;
  }

  private static hashSignature(signature: string): string {
    return createHash('sha256').update(signature).digest('hex');
  }

  private static cacheKey(signature: string): string {
    return `${SignatureExtractorCache.CACHE_PREFIX}${SignatureExtractorCache.hashSignature(signature)}`;
  }

  async extract(email: string, signature: string): Promise<PersonLD | null> {
    const key = SignatureExtractorCache.cacheKey(signature);
    const signatureHash = SignatureExtractorCache.hashSignature(signature);

    const cached = await this.redis.get(key);
    if (cached) {
      this.logger.debug('LLM signature cache hit', {
        wrappedEngine: this.wrappedEngineName,
        signatureHash
      });
      return JSON.parse(cached);
    }

    this.logger.debug('LLM signature cache miss, calling wrapped engine', {
      wrappedEngine: this.wrappedEngineName,
      signatureHash
    });

    const result = await this.wrapped.extract(email, signature);

    if (result) {
      await this.redis.setex(key, this.ttlSeconds, JSON.stringify(result));
      this.logger.debug('LLM response cached', {
        wrappedEngine: this.wrappedEngineName,
        ttlSeconds: this.ttlSeconds
      });
    }

    return result;
  }
}
