# Short URLs Tracking Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure short URL tracking responses are consistent and regression-proof, with explicit redirect headers and tests.

**Architecture:** Add a tiny shared helper for redirect responses that always includes CORS headers, then use it from tracking handlers and verify with Deno tests.

**Tech Stack:** Supabase Edge Functions (Deno), Hono

---

### Task 1: Add redirect response helper

**Files:**

- Create: `supabase/functions/email-campaigns/http.ts`

**Step 1: Write the failing test**

Create `supabase/functions/email-campaigns/http.test.ts`:

```ts
import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import corsHeaders from "../_shared/cors.ts";
import { buildRedirectResponse } from "./http.ts";

Deno.test("buildRedirectResponse includes CORS headers and Location", () => {
  const location = "https://example.com";
  const res = buildRedirectResponse(location);

  assertEquals(res.status, 302);
  assertEquals(res.headers.get("Location"), location);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    assert(res.headers.get(key) === value);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `deno test -A supabase/functions/email-campaigns/http.test.ts`
Expected: FAIL with "buildRedirectResponse is not defined"

**Step 3: Write minimal implementation**

Create `supabase/functions/email-campaigns/http.ts`:

```ts
import corsHeaders from "../_shared/cors.ts";

export function buildRedirectResponse(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: location,
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `deno test -A supabase/functions/email-campaigns/http.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/email-campaigns/http.ts supabase/functions/email-campaigns/http.test.ts
git commit -m "test: add redirect response helper"
```

---

### Task 2: Use helper in tracking handlers

**Files:**

- Modify: `supabase/functions/email-campaigns/index.ts`

**Step 1: Write the failing test**

Update `supabase/functions/email-campaigns/http.test.ts`:

```ts
import { buildRedirectResponse } from "./http.ts";

Deno.test("buildRedirectResponse preserves location across uses", () => {
  const location = "https://example.com/path";
  const res = buildRedirectResponse(location);
  assertEquals(res.headers.get("Location"), location);
});
```

**Step 2: Run test to verify it fails**

Run: `deno test -A supabase/functions/email-campaigns/http.test.ts`
Expected: PASS (no new failure)

**Step 3: Update tracking handlers**

In `supabase/functions/email-campaigns/index.ts`, replace inline redirect responses in:

- `/track/click/:token`
- `/unsubscribe/:token`

with:

```ts
return buildRedirectResponse(link.url);
```

and

```ts
return buildRedirectResponse(successUrl);
```

**Step 4: Run tests**

Run: `deno test -A supabase/functions/email-campaigns/http.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/email-campaigns/index.ts
git commit -m "refactor: reuse redirect response helper"
```
