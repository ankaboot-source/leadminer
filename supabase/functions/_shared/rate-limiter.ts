// deno-lint-ignore-file no-explicit-any
import RedisClient from "ioredis";

const REDIS_URL = Deno.env.get("REDIS_URL");

let redisClient: any = null;
let redisUnavailable = false;

function getRedisClient(): any {
  if (redisUnavailable) {
    return null;
  }
  if (!redisClient) {
    if (!REDIS_URL) {
      redisUnavailable = true;
      return null;
    }
    // deno-lint-ignore no-explicit-any
    redisClient = new (RedisClient as any)(REDIS_URL);
  }
  return redisClient;
}

export type QuotaType = "criticalRead" | "criticalWrite" | "read" | "write";

interface QuotaConfig {
  requests: number;
  intervalSeconds: number;
}

const DEFAULT_QUOTAS: Record<QuotaType, QuotaConfig> = {
  criticalRead: { requests: 90, intervalSeconds: 60 },
  criticalWrite: { requests: 90, intervalSeconds: 60 },
  read: { requests: 120, intervalSeconds: 60 },
  write: { requests: 90, intervalSeconds: 60 },
};

export class TokenBucketRateLimiter {
  private redis: any;
  private key: string;
  private requests: number;
  private intervalSeconds: number;

  constructor(
    uniqueKey: string,
    quotaType: QuotaType,
    customConfig?: Partial<QuotaConfig>,
  ) {
    this.redis = getRedisClient();
    this.key = `rate-limit:${uniqueKey}:${quotaType}`;
    const config = { ...DEFAULT_QUOTAS[quotaType], ...customConfig };
    this.requests = config.requests;
    this.intervalSeconds = config.intervalSeconds;
  }

  async removeTokens(tokens: number): Promise<void> {
    if (!this.redis) {
      return; // Redis unavailable — skip rate limiting
    }

    const now = Date.now();
    const window = this.intervalSeconds * 1000;

    const multi = this.redis.multi();

    multi.zremrangebyscore(this.key, 0, now - window);
    multi.zcard(this.key);

    const results = await multi.exec();
    const currentCount = (results?.[1]?.[1] as number) || 0;

    if (currentCount + tokens > this.requests) {
      const oldest = await this.redis.zrange(
        this.key,
        0,
        0,
        "WITHSCORES",
      );
      if (oldest.length >= 2) {
        const retryAfter = parseInt(oldest[1]) + window - now;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(retryAfter, 0))
        );
      }
    }

    const timestamps = Array.from({ length: tokens }, () => now);
    const scoreMembers = timestamps.map((ts) => [ts, `${ts}-${Math.random()}`] as [number, string]);

    const addMulti = this.redis.multi();
    for (const [score, member] of scoreMembers) {
      addMulti.zadd(this.key, score, member);
    }
    addMulti.expire(this.key, this.intervalSeconds * 2);
    await addMulti.exec();
  }

  async close(): Promise<void> {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
    }
  }
}

export async function withRateLimit<T>(
  requirements: { type: QuotaType; weight: number }[],
  uniqueKey: string,
  callback: () => Promise<T>,
): Promise<T> {
  const limiters = requirements.map(
    (r) => new TokenBucketRateLimiter(uniqueKey, r.type),
  );

  // If Redis is unavailable, skip rate limiting entirely
  if (limiters.some((l) => !(l as any).redis)) {
    return await callback();
  }

  try {
    await Promise.all(
      limiters.map((l, i) => l.removeTokens(requirements[i].weight)),
    );
    return await callback();
  } finally {
    // Redis connections are reused via singleton
  }
}
