# OAUTH_CALLBACK_BASE_URL Env Var Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `OAUTH_CALLBACK_BASE_URL` a standalone required env var (no fallbacks) so the OAuth callback URL used by Google/Azure is explicit and predictable.

**Architecture:** The `mining-sources` edge function constructs OAuth callback URLs from `OAUTH_CALLBACK_BASE_URL`. Currently it has a fallback chain across 3 env vars. Strip that to a single required env var read via `getRequiredEnv`. Update .env.dev to match. Update PR description.

**Tech Stack:** TypeScript (Deno), Supabase Edge Functions

---

### Task 1: Strip fallback chain in index.ts

**Files:**
- Modify: `supabase/functions/mining-sources/index.ts:37-47`

- [ ] **Step 1: Replace the multi-env fallback IIFE with getRequiredEnv**

Replace lines 37-47:
```typescript
const OAUTH_CALLBACK_BASE_URL = (() => {
  const url = Deno.env.get("OAUTH_CALLBACK_BASE_URL")
    ?? Deno.env.get("SUPABASE_PROJECT_URL")
    ?? Deno.env.get("SUPABASE_URL");
  if (!url) {
    throw new Error(
      "Missing OAUTH_CALLBACK_BASE_URL, SUPABASE_PROJECT_URL, or SUPABASE_URL",
    );
  }
  return url.replace(/\/+$/, "");
})();
```

With:
```typescript
const OAUTH_CALLBACK_BASE_URL = getRequiredEnv(
  "OAUTH_CALLBACK_BASE_URL",
).replace(/\/+$/, "");
```

- [ ] **Step 2: Run tests to verify they still pass**

Run:
```bash
deno test supabase/functions/mining-sources/index.test.ts --config supabase/functions/mining-sources/deno.json
```
Expected: `ok | 12 passed | 0 failed`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/mining-sources/index.ts
git commit -m "feat: make oauth_callback_base_url a required env var with no fallbacks"
```

---

### Task 2: Update .env.dev comment

**Files:**
- Modify: `supabase/functions/.env.dev:16`

- [ ] **Step 1: Update the OAUTH_CALLBACK_BASE_URL line to mark it as REQUIRED**

Replace:
```
OAUTH_CALLBACK_BASE_URL = http://localhost:54321                # For self-hosted: Your public Supabase URL (e.g., https://db.yourdomain.com). OAuth providers redirect here. Falls back to SUPABASE_PROJECT_URL then SUPABASE_URL.
```

With:
```
OAUTH_CALLBACK_BASE_URL = http://localhost:54321                # ( REQUIRED ) Public Supabase URL for OAuth callback. OAuth providers redirect here (e.g., https://db.yourdomain.com for production).
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/.env.dev
git commit -m "docs: mark oauth_callback_base_url as required in env template"
```

---

### Task 3: Update PR description

**Files:**
- Modify: PR #2814 description

- [ ] **Step 1: Fetch current PR body**

```bash
gh pr view 2814 --json body --jq '.body'
```

- [ ] **Step 2: Update the migration guide section**

Replace the "New Env Variable" section with a simpler version that reflects the standalone required env var (no fallback). Also remove the fallback mention from the Changes bullets.

Updated section:
```
### New Env Variable

Add `OAUTH_CALLBACK_BASE_URL` to your edge function env:

| Environment | Value |
|---|---|
| Production (self-hosted) | `https://db.yourdomain.com` |
| Production (SaaS) | `https://db.leadminer.io` |
| Local dev | `http://localhost:54321` |

This is the **public** Supabase URL that OAuth providers redirect to during the callback flow. No fallbacks — must be set explicitly.
```

- [ ] **Step 3: Update the body**

```bash
gh pr edit 2814 --body "<updated body>"
```

---

### Task 4: Document leadminer.io changes needed (reference only)

**Not executable from this repo — manual steps for leadminer.io.**

Add `OAUTH_CALLBACK_BASE_URL` to these files in the `leadminer.io` repo:

1. **`supabase/functions/.env.dev`**: `OAUTH_CALLBACK_BASE_URL = http://localhost:54321`
2. **`supabase/functions/.env.prod`**: `OAUTH_CALLBACK_BASE_URL =`
3. **`ansible/supabase-deployment/vars/prod.yml`**: `OAUTH_CALLBACK_BASE_URL: https://db.leadminer.io`
4. **`ansible/supabase-deployment/vars/qa.yml`**: `OAUTH_CALLBACK_BASE_URL: https://db-qa.leadminer.io`
5. **`ansible/supabase-deployment/roles/supabase/templates/compose.j2`**: Add `OAUTH_CALLBACK_BASE_URL: ${OAUTH_CALLBACK_BASE_URL}` to the supabase-functions service env section
6. **`ansible/supabase-deployment/roles/supabase/templates/supabase.env.conf.j2`**: Add `OAUTH_CALLBACK_BASE_URL=${OAUTH_CALLBACK_BASE_URL}`
