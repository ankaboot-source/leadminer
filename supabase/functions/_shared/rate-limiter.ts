/**
 * Rate limiter for Supabase Edge Functions.
 *
 * Ported from the backend's `TokenBucketRateLimiter`
 * (`backend/src/services/rate-limiter/index.ts`) to the Deno edge runtime.
 *
 * Differences from the backend:
 * - Only `Memory` and `Redis` distributions are supported (PostgreSQL is omitted
 *   because the `pg` Pool is Node-only).
 * - Falls back to in-memory limiting when `REDIS_URL` is unset.
 * - Uses the shared edge `createLogger` instead of `winston`.
 * - `removeTokens` returns `Promise<void>` and retries on
 *   `RateLimiterRes` (preserves the soft-retry semantics of the previous
 *   custom implementation so existing callers do not have to handle rejections).
 */

import {
  RateLimiterMemory,
  type RateLimiterAbstract,
  RateLimiterQueue,
  RateLimiterRedis,
  RateLimiterRes,
} from "rate-limiter-flexible";
import { Redis } from "ioredis";
import { createLogger } from "./logger.ts";

const logger = createLogger("rate-limiter");

const REDIS_URL = Deno.env.get("REDIS_URL");

/**
 * Maximum number of times `removeTokens` will sleep and retry when the
 * rate-limiter rejects a consume. Bounds total wait time so a misconfigured
 * quota cannot block a request indefinitely.
 */
const MAX_RATE_LIMIT_RETRIES = 10;

/**
 * Minimum delay between retries in milliseconds. Acts as a safety floor when
 * `RateLimiterRes.msBeforeNext` is unusually small.
 */
const MIN_RETRY_DELAY_MS = 25;

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }
  if (!REDIS_URL) {
    return null;
  }
  try {
    redisClient = new Redis(REDIS_URL, {
      // Match the backend's redis manager so commands don't fail with
      // "Reached the max retries per request limit" while we are
      // establishing the connection.
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("Failed to create Redis client, falling back to memory", {
      error: msg,
    });
    redisClient = null;
  }
  return redisClient;
}

export type QuotaType = "criticalRead" | "criticalWrite" | "read" | "write";

export interface QuotaConfig {
  requests: number;
  intervalSeconds: number;
}

const DEFAULT_QUOTAS: Record<QuotaType, QuotaConfig> = {
  criticalRead: { requests: 90, intervalSeconds: 60 },
  criticalWrite: { requests: 90, intervalSeconds: 60 },
  read: { requests: 120, intervalSeconds: 60 },
  write: { requests: 90, intervalSeconds: 60 },
};

function createBaseLimiter(
  config: QuotaConfig,
  keyPrefix: string,
): RateLimiterAbstract {
  const redis = getRedisClient();
  if (redis) {
    return new RateLimiterRedis({
      storeClient: redis,
      keyPrefix,
      points: config.requests,
      duration: config.intervalSeconds,
    });
  }
  return new RateLimiterMemory({
    keyPrefix,
    points: config.requests,
    duration: config.intervalSeconds,
  });
}

/**
 * Token-bucket rate limiter. Public API is intentionally compatible with the
 * previous custom implementation so callers (e.g. `contacts-api.ts`) do not
 * need to change.
 */
export class TokenBucketRateLimiter {
  private readonly limiter: RateLimiterQueue;
  private readonly uniqueKey: string;
  private readonly quotaType: QuotaType;

  constructor(
    uniqueKey: string,
    quotaType: QuotaType,
    customConfig?: Partial<QuotaConfig>,
  ) {
    this.uniqueKey = uniqueKey;
    this.quotaType = quotaType;

    const config: QuotaConfig = {
      ...DEFAULT_QUOTAS[quotaType],
      ...customConfig,
    };

    // `rate-limiter-flexible` constructs the storage key from
    // `<keyPrefix>:<consumeKey>`. We don't pass a consume key, so the
    // prefix alone is used. Include the quota type to keep different
    // quotas on independent buckets even when the unique key is the same.
    const keyPrefix = `rl:${uniqueKey}:${quotaType}`;
    const baseLimiter = createBaseLimiter(config, keyPrefix);
    this.limiter = new RateLimiterQueue(baseLimiter);
  }

  /**
   * Removes `tokens` from the bucket. If the bucket cannot satisfy the
   * request, waits for `msBeforeNext` and retries. Throws only when the
   * limiter is misconfigured, the underlying store errors out, or the
   * retry budget is exhausted.
   */
  async removeTokens(tokens: number): Promise<void> {
    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
      try {
        await this.limiter.removeTokens(tokens);
        return;
      } catch (err) {
        if (
          err instanceof RateLimiterRes &&
          attempt < MAX_RATE_LIMIT_RETRIES
        ) {
          const waitMs = Math.max(
            err.msBeforeNext ?? 0,
            MIN_RETRY_DELAY_MS,
          );
          logger.debug("Rate limit reached, waiting before retry", {
            uniqueKey: this.uniqueKey,
            quotaType: this.quotaType,
            tokens,
            attempt,
            waitMs,
          });
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw err;
      }
    }
  }

  static async close(): Promise<void> {
    if (redisClient) {
      const client = redisClient;
      redisClient = null;
      try {
        await client.quit();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn("Error while closing Redis client", { error: msg });
      }
    }
  }
}

/**
 * Runs `callback` after consuming tokens from each requested quota bucket.
 * If any bucket cannot satisfy its request, the call is delayed (and retried)
 * rather than rejected, matching the soft behavior of the previous
 * implementation.
 */
export async function withRateLimit<T>(
  requirements: { type: QuotaType; weight: number }[],
  uniqueKey: string,
  callback: () => Promise<T>,
): Promise<T> {
  const limiters = requirements.map(
    (r) => new TokenBucketRateLimiter(uniqueKey, r.type),
  );

  await Promise.all(
    limiters.map((l, i) => l.removeTokens(requirements[i].weight)),
  );

  return await callback();
}
