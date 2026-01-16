import {
  RateLimiterMemory,
  RateLimiterPostgres,
  RateLimiterQueue,
  RateLimiterRedis
} from 'rate-limiter-flexible';
import redis from '../../utils/redis';
import pool from '../../db/pg';

export interface IRateLimiter {
  throttleRequests<T>(callback: () => Promise<T>): Promise<T>;
  remainingRequests(): Promise<number>;
  removeTokens(tokens: number): Promise<number>;
}

export enum Distribution {
  Memory = 'memory',
  Redis = 'redis',
  Postgresql = 'postgresql'
}

export interface RateLimiterOptions {
  intervalSeconds: number;
  requests: number;
  uniqueKey: string;
  executeEvenly: boolean;
  distribution: Distribution;
}

export class TokenBucketRateLimiter implements IRateLimiter {
  private readonly limiter: RateLimiterQueue;

  constructor({
    intervalSeconds,
    requests,
    uniqueKey,
    executeEvenly,
    distribution
  }: RateLimiterOptions) {
    const baseLimiter = TokenBucketRateLimiter.createLimiter({
      intervalSeconds,
      requests,
      uniqueKey,
      executeEvenly,
      distribution
    });
    this.limiter = new RateLimiterQueue(baseLimiter);
  }

  /**
   * Factory: create limiter backend based on distribution type.
   */
  static createLimiter(opt: RateLimiterOptions) {
    switch (opt.distribution) {
      case Distribution.Memory:
        return new RateLimiterMemory({
          keyPrefix: opt.uniqueKey,
          points: opt.requests,
          duration: opt.intervalSeconds,
          execEvenly: opt.executeEvenly
        });

      case Distribution.Redis:
        return new RateLimiterRedis({
          storeClient: redis.getClient(),
          keyPrefix: opt.uniqueKey,
          points: opt.requests,
          duration: opt.intervalSeconds,
          execEvenly: opt.executeEvenly
        });

      case Distribution.Postgresql:
        return new RateLimiterPostgres({
          storeClient: pool,
          keyPrefix: opt.uniqueKey,
          points: opt.requests,
          duration: opt.intervalSeconds,
          execEvenly: opt.executeEvenly
        });

      default:
        throw new Error(`Unknown distribution type: ${opt.distribution}`);
    }
  }

  /**
   * Executes a request and consumes 1 tokens.
   */
  async throttleRequests<T>(callback: () => Promise<T>): Promise<T> {
    await this.limiter.removeTokens(1);
    return callback();
  }

  /**
   * Returns number of tokens available in current window.
   */
  async remainingRequests(): Promise<number> {
    return this.limiter.getTokensRemaining();
  }

  /**
   * Removes n tokens from bucket and returns remaining
   */
  async removeTokens(tokens: number): Promise<number> {
    await this.limiter.removeTokens(tokens);
    return this.limiter.getTokensRemaining();
  }
}
