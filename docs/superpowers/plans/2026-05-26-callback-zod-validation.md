# Callback Route Zod Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Zod validation to the `GET /oauth/callback/:provider` route and eliminate manual `if`-check validation for query params.

**Architecture:** The callback route currently validates `provider` (path param), `code`, and `state` (query params) with ad-hoc `if` checks. Replace with a shared Zod schema in `schemas.ts`, keeping validation patterns consistent with the other two routes. This also provides HPP protection — Hono's `c.req.query()` returns `string | undefined` for single values, and Zod's `.string().min(1)` rejects empty, non-string, or array-like input.

**Tech Stack:** TypeScript (Deno), Zod, Hono

---

### Task 1: Add callbackQuerySchema to schemas.ts

**Files:**
- Modify: `supabase/functions/mining-sources/schemas.ts:13`

- [ ] **Step 1: Add callbackQuerySchema**

Add after line 12 (after the closing `});` of `authorizeSchema`):

```typescript
export const callbackQuerySchema = z.object({
  provider: z.enum(["google", "azure"]),
  code: z.string().min(1),
  state: z.string().min(1),
});
```

This covers:
- `provider` must be exactly `"google"` or `"azure"` (path param validation)
- `code` must be a non-empty string (query param, HPP-safe via Hono)
- `state` must be a non-empty string (query param, HPP-safe via Hono)
- `.strict()` is not needed — extra query params are ignored (HTTP allows them)

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/mining-sources/schemas.ts
git commit -m "feat: add callbackQuerySchema for oauth callback route validation"
```

---

### Task 2: Add callbackQuerySchema tests

**Files:**
- Modify: `supabase/functions/mining-sources/index.test.ts:1-2`

- [ ] **Step 1: Add callbackQuerySchema to imports**

Update line 2 to import the new schema:
```typescript
import { createSchema, authorizeSchema, callbackQuerySchema } from "./schemas.ts";
```

- [ ] **Step 2: Add test cases before the closing of the file (after line 113)**

Add these tests:

```typescript
Deno.test("callbackQuerySchema accepts valid google input", () => {
  const result = callbackQuerySchema.safeParse({
    provider: "google",
    code: "auth-code-123",
    state: "encoded-state-data",
  });
  assertEquals(result.success, true);
});

Deno.test("callbackQuerySchema accepts valid azure input", () => {
  const result = callbackQuerySchema.safeParse({
    provider: "azure",
    code: "auth-code-456",
    state: "encoded-state-data",
  });
  assertEquals(result.success, true);
});

Deno.test("callbackQuerySchema rejects invalid provider", () => {
  const result = callbackQuerySchema.safeParse({
    provider: "invalid",
    code: "auth-code-123",
    state: "encoded-state-data",
  });
  assertEquals(result.success, false);
  assert(result.success || result.error.issues.some((i) => i.path.includes("provider")));
});

Deno.test("callbackQuerySchema rejects empty code", () => {
  const result = callbackQuerySchema.safeParse({
    provider: "google",
    code: "",
    state: "encoded-state-data",
  });
  assertEquals(result.success, false);
  assert(result.success || result.error.issues.some((i) => i.path.includes("code")));
});

Deno.test("callbackQuerySchema rejects empty state", () => {
  const result = callbackQuerySchema.safeParse({
    provider: "google",
    code: "auth-code-123",
    state: "",
  });
  assertEquals(result.success, false);
  assert(result.success || result.error.issues.some((i) => i.path.includes("state")));
});

Deno.test("callbackQuerySchema rejects missing required fields", () => {
  const result = callbackQuerySchema.safeParse({});
  assertEquals(result.success, false);
  assert(
    result.success ||
      result.error.issues.some((i) => i.path.includes("provider")) &&
      result.error.issues.some((i) => i.path.includes("code")) &&
      result.error.issues.some((i) => i.path.includes("state")),
  );
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
deno test supabase/functions/mining-sources/index.test.ts --config supabase/functions/mining-sources/deno.json
```
Expected: `ok | 18 passed | 0 failed`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/mining-sources/index.test.ts
git commit -m "test: add callbackQuerySchema tests"
```

---

### Task 3: Update callback handler to use Zod validation

**Files:**
- Modify: `supabase/functions/mining-sources/index.ts:132-149`

- [ ] **Step 1: Add callbackQuerySchema import**

Update line 10 in `index.ts`:
```typescript
import { createSchema, authorizeSchema, callbackQuerySchema } from "./schemas.ts";
```

- [ ] **Step 2: Replace manual validation with Zod in the callback handler**

Replace lines 134-149:
```typescript
    const provider = c.req.param("provider");
    if (provider !== "google" && provider !== "azure") {
      return c.redirect(
        `${FRONTEND_HOST}/callback?error=oauth-permissions&provider=${provider}&referrer=&navigate_to=/`,
        302,
      );
    }

    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!code || !state) {
      return c.redirect(
        `${FRONTEND_HOST}/callback?error=oauth-permissions&provider=${provider}&referrer=&navigate_to=/`,
        302,
      );
    }
```

With:
```typescript
    const parsed = callbackQuerySchema.safeParse({
      provider: c.req.param("provider"),
      code: c.req.query("code"),
      state: c.req.query("state"),
    });
    if (!parsed.success) {
      return c.redirect(
        `${FRONTEND_HOST}/callback?error=oauth-permissions&provider=${c.req.param("provider")}&referrer=&navigate_to=/`,
        302,
      );
    }

    const { provider, code, state } = parsed.data;
```

- [ ] **Step 3: Verify callback still accesses `state` correctly downstream**

The downstream code uses `state` directly (e.g., `parseOAuthState(state, HASH_SECRET)`). After the change, `state` is from `parsed.data` (Zod-validated), so behavior is identical but safer.

- [ ] **Step 4: Run all tests to verify**

```bash
deno test supabase/functions/mining-sources/ --config supabase/functions/mining-sources/deno.json --allow-env
```
Expected: `ok | 30 passed | 0 failed`

- [ ] **Step 5: Commit and push**

```bash
git add supabase/functions/mining-sources/index.ts
git commit -m "feat: use zod validation for oauth callback route params"
git push origin feat/mining-sources-edge-function
```
