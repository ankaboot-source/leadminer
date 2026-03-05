# Shared HTTP Redirect Helper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the redirect helper into shared edge-function utilities so multiple functions can reuse it consistently.

**Architecture:** Create `_shared/http.ts` with `buildRedirectResponse` and update email-campaigns to import it. Keep redirect behavior unchanged.

**Tech Stack:** Supabase Edge Functions (Deno), Hono

---

### Task 1: Move helper into shared utilities

**Files:**

- Create: `supabase/functions/_shared/http.ts`
- Modify: `supabase/functions/email-campaigns/http.ts`
- Modify: `supabase/functions/email-campaigns/http.test.ts`

**Step 1: Write the failing test**

Update `supabase/functions/email-campaigns/http.test.ts` to import from shared:

```ts
import { buildRedirectResponse } from "../_shared/http.ts";
```

Expected failure until shared helper exists.

**Step 2: Run test to verify it fails**

Run: `deno test -A supabase/functions/email-campaigns/http.test.ts`
Expected: FAIL with module not found `../_shared/http.ts`

**Step 3: Implement shared helper**

Create `supabase/functions/_shared/http.ts`:

```ts
import corsHeaders from "./cors.ts";

export const buildRedirectResponse = (location: string): Response => {
  const headers = new Headers(corsHeaders);
  headers.set("Location", location);

  return new Response(null, {
    status: 302,
    headers,
  });
};
```

**Step 4: Re-export from email-campaigns (temporary)**

Update `supabase/functions/email-campaigns/http.ts` to re-export:

```ts
export { buildRedirectResponse } from "../_shared/http.ts";
```

**Step 5: Run test to verify it passes**

Run: `deno test -A supabase/functions/email-campaigns/http.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add supabase/functions/_shared/http.ts supabase/functions/email-campaigns/http.ts supabase/functions/email-campaigns/http.test.ts
git commit -m "refactor: share redirect response helper"
```

---

### Task 2: Update email-campaigns imports to shared helper

**Files:**

- Modify: `supabase/functions/email-campaigns/index.ts`

**Step 1: Write the failing test**

No new unit test required; rely on existing `http.test.ts` and lint/type-check.

**Step 2: Update imports**

Change import to:

```ts
import { buildRedirectResponse } from "../_shared/http.ts";
```

**Step 3: Run tests**

Run: `deno test -A supabase/functions/email-campaigns/http.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add supabase/functions/email-campaigns/index.ts
git commit -m "refactor: use shared redirect helper"
```

---

### Task 3: Remove email-campaigns helper shim

**Files:**

- Delete: `supabase/functions/email-campaigns/http.ts`

**Step 1: Update test import to shared helper**

Ensure `supabase/functions/email-campaigns/http.test.ts` already imports from `../_shared/http.ts`.

**Step 2: Remove file**

Delete `supabase/functions/email-campaigns/http.ts`.

**Step 3: Run tests**

Run: `deno test -A supabase/functions/email-campaigns/http.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add supabase/functions/email-campaigns/http.test.ts
git rm supabase/functions/email-campaigns/http.ts
git commit -m "refactor: remove email-campaigns redirect shim"
```
