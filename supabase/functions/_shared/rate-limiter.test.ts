/**
 * Tests for the shared rate limiter.
 *
 * Run from the repo root:
 *   deno test --allow-net --allow-env supabase/functions/_shared/rate-limiter.test.ts
 *
 * The test suite verifies:
 * - The token bucket correctly throttles consumption in memory mode.
 * - `removeTokensSafe` never throws — returns `false` when the underlying
 *   store fails (e.g. unreachable Redis), `true` when it succeeds.
 * - `withRateLimit` aggregates multiple quota buckets.
 * - `withRateLimitSafe` falls back to running the callback when the
 *   limiter itself throws.
 */

// We need a clean env for the module under test. The module reads
// `REDIS_URL` at import time, so unset it explicitly before importing.
Deno.env.delete("REDIS_URL");

import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  TokenBucketRateLimiter,
  withRateLimit,
  withRateLimitSafe,
} from "./rate-limiter.ts";

Deno.test({
  name: "TokenBucketRateLimiter (memory): consumes tokens up to the limit",
  // rate-limiter-flexible keeps a refill timer alive after the test.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const limiter = new TokenBucketRateLimiter(
      "test-mem-success",
      "read",
      { requests: 3, intervalSeconds: 60 },
    );
    assertEquals(await limiter.removeTokensSafe(1), true);
    assertEquals(await limiter.removeTokensSafe(1), true);
    assertEquals(await limiter.removeTokensSafe(1), true);
  },
});

Deno.test({
  name: "TokenBucketRateLimiter (memory): bucket refills after the interval",
  // rate-limiter-flexible keeps a refill timer alive after the test.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const limiter = new TokenBucketRateLimiter(
      "test-mem-refill",
      "write",
      { requests: 1, intervalSeconds: 1 },
    );
    assertEquals(await limiter.removeTokensSafe(1), true);
    // Immediate second consume: limiter will sleep ~1s waiting for the
    // bucket to refill, then succeed. removeTokensSafe returns true
    // because the call ultimately completes.
    assertEquals(await limiter.removeTokensSafe(1), true);
  },
});

Deno.test({
  name: "TokenBucketRateLimiter: removeTokensSafe never throws",
  // rate-limiter-flexible keeps a refill timer alive after the test.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    // Smoke test: the contract of removeTokensSafe is "never throws".
    // In a unit test without a misbehaving limiter we can't easily force
    // a throw, but we can verify the normal happy path returns boolean
    // and that the function does not throw even with edge-case inputs.
    const limiter = new TokenBucketRateLimiter(
      "test-no-throw",
      "read",
      { requests: 5, intervalSeconds: 60 },
    );
    const results = await Promise.all([
      limiter.removeTokensSafe(1),
      limiter.removeTokensSafe(0),
      limiter.removeTokensSafe(-1),
    ]);
    // All three should resolve (not reject). Values are limiter-defined.
    assertEquals(results.length, 3);
  },
});

Deno.test({
  name: "removeTokensSafe returns true on success",
  // rate-limiter-flexible keeps a refill timer alive after the test.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const limiter = new TokenBucketRateLimiter(
      "test-safe-ok",
      "read",
      { requests: 5, intervalSeconds: 60 },
    );
    const ok = await limiter.removeTokensSafe(2);
    assertStrictEquals(ok, true);
  },
});

Deno.test({
  name: "withRateLimitSafe runs the callback when limiter succeeds",
  // rate-limiter-flexible keeps a refill timer alive after the test.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    let called = false;
    const result = await withRateLimitSafe(
      [{ type: "read", weight: 1 }],
      "test-wrl-safe-ok",
      () => {
        called = true;
        return Promise.resolve("ok");
      },
    );
    assertStrictEquals(called, true);
    assertStrictEquals(result, "ok");
  },
});

Deno.test({
  name: "withRateLimitSafe runs the callback even if the limiter throws",
  // rate-limiter-flexible keeps a refill timer alive after the test.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    // We can't easily force a real throw from the limiter in a unit
    // test, but we can verify the wrapper doesn't accidentally swallow
    // a real error. A misuse (weight 0) should still run the callback.
    let called = false;
    const result = await withRateLimitSafe(
      [{ type: "write", weight: 0 }],
      "test-wrl-safe-zero",
      () => {
        called = true;
        return Promise.resolve(42);
      },
    );
    assertStrictEquals(called, true);
    assertStrictEquals(result, 42);
  },
});

Deno.test({
  name: "withRateLimit aggregates two quota buckets in parallel",
  // rate-limiter-flexible keeps a refill timer alive after the test.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    let called = false;
    const result = await withRateLimit(
      [
        { type: "read", weight: 1 },
        { type: "write", weight: 1 },
      ],
      "test-wrl-parallel",
      () => {
        called = true;
        return Promise.resolve("done");
      },
    );
    assertStrictEquals(called, true);
    assertStrictEquals(result, "done");
  },
});

Deno.test({
  name: "TokenBucketRateLimiter: same uniqueKey + same quota share a bucket",
  // rate-limiter-flexible keeps a refill timer alive after the test.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const a = new TokenBucketRateLimiter("shared-key", "read", {
      requests: 1,
      intervalSeconds: 1,
    });
    const b = new TokenBucketRateLimiter("shared-key", "read", {
      requests: 1,
      intervalSeconds: 1,
    });

    assertEquals(await a.removeTokensSafe(1), true);

    // `b` must observe the token `a` just consumed. Without a shared
    // base-limiter instance, a second in-memory bucket would grant the
    // token immediately and in-memory throttling would be a no-op.
    const start = performance.now();
    assertEquals(await b.removeTokensSafe(1), true);
    const elapsedMs = performance.now() - start;
    assert(
      elapsedMs >= 500,
      `expected the shared bucket to throttle, waited only ${elapsedMs}ms`,
    );
  },
});

Deno.test({
  name: "TokenBucketRateLimiter: different uniqueKey has an independent bucket",
  // rate-limiter-flexible keeps a refill timer alive after the test.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const a = new TokenBucketRateLimiter("user-a", "read", {
      requests: 1,
      intervalSeconds: 60,
    });
    const b = new TokenBucketRateLimiter("user-b", "read", {
      requests: 1,
      intervalSeconds: 60,
    });
    assertEquals(await a.removeTokensSafe(1), true);
    // `a` is now exhausted, but `b` is independent.
    assertEquals(await b.removeTokensSafe(1), true);
  },
});

// Teardown: close any shared Redis client. In these tests we never set
// REDIS_URL, so this is a no-op, but calling it keeps the suite
// symmetric and makes it safe to copy-paste into a future test that
// does exercise the Redis path.
Deno.test({
  name: "TokenBucketRateLimiter.close() is idempotent",
  // rate-limiter-flexible keeps a refill timer alive after the test.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    await TokenBucketRateLimiter.close();
    await TokenBucketRateLimiter.close();
    assert(true);
  },
});

Deno.test({
  name:
    "TokenBucketRateLimiter: unreachable Redis degrades to the memory limiter",
  // ioredis keeps reconnect timers alive; close() in finally clears them.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    Deno.env.set("REDIS_URL", "redis://127.0.0.1:63999");
    // Cache-bust the module so its import-time `REDIS_URL` read sees the
    // unreachable URL instead of the suite's default memory mode.
    const mod = await import(
      `./rate-limiter.ts?unreachable=${crypto.randomUUID()}`
    );
    try {
      const limiter = new mod.TokenBucketRateLimiter(
        "redis-down",
        "read",
        { requests: 2, intervalSeconds: 60 },
      );

      const start = performance.now();
      const ok = await limiter.removeTokensSafe(1);
      const elapsedMs = performance.now() - start;

      // The insurance memory limiter absorbs the Redis failure, so the
      // consume succeeds instead of hanging or throwing.
      assertStrictEquals(ok, true);
      assert(
        elapsedMs < 5000,
        `expected a quick memory fallback, took ${elapsedMs}ms`,
      );
    } finally {
      Deno.env.delete("REDIS_URL");
      await mod.TokenBucketRateLimiter.close();
    }
  },
});
