import { RateLimiter, Interval } from 'limiter';

export interface IRateLimiter {
  throttleRequests<T>(callback: () => Promise<T>): Promise<T>;
  remainingRequests(): number;
}

export class TokenBucketRateLimiter implements IRateLimiter {
  private readonly limiter: RateLimiter;

  constructor(tokensPerInterval: number, interval: Interval | number) {
    this.limiter = new RateLimiter({ tokensPerInterval, interval });
  }

  async throttleRequests<T>(callback: () => Promise<T>): Promise<T> {
    await this.limiter.removeTokens(1);
    return callback();
  }

  remainingRequests(): number {
    return this.limiter.getTokensRemaining();
  }
}
