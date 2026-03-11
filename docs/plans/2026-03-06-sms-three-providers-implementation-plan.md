# SMS Three Providers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add explicit manual provider selection for `smsgate`, `simple-sms-gateway`, and `twilio` across SMS campaign create/preview/process and UI settings.

**Architecture:** Extend the existing provider-factory pattern with a new `simple-sms-gateway` adapter and per-user profile credentials, then thread the new provider through status/config endpoints and frontend selector/config screens. Keep Twilio env-based and preserve manual selection semantics (no provider fallback chain).

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript + Hono), PostgreSQL migrations, Nuxt 3/Vue 3 (PrimeVue), existing SMS provider abstraction.

---

### Task 1: Extend database schema for third provider

**Files:**

- Create: `supabase/migrations/20260306110000_add_simple_sms_gateway_provider.sql`
- Modify: `supabase/migrations/20260304100000_add_sms_campaigns.sql`
- Modify: `supabase/migrations/20260305130000_add_sms_provider_profile_config.sql`

**Step 1: Write a failing migration expectation test (manual SQL check)**

Define expected SQL state before edits:

- `private.sms_campaigns.provider` accepts `simple-sms-gateway`
- `private.profiles` has `simple_sms_gateway_base_url`, `simple_sms_gateway_username`, `simple_sms_gateway_password`

**Step 2: Verify current state fails expectation**

Run: `grep -n "simple-sms-gateway\|simple_sms_gateway" supabase/migrations/*.sql`
Expected: no matching provider/profile fields yet.

**Step 3: Write minimal migration changes**

- Add new migration to alter provider check constraint to include `simple-sms-gateway`.
- Add new columns to `private.profiles` with `ADD COLUMN IF NOT EXISTS`.
- Keep backward-safe SQL (drop/recreate only target check constraint).

**Step 4: Verify migration text is correct**

Run: `grep -n "simple-sms-gateway\|simple_sms_gateway" supabase/migrations/*.sql`
Expected: new migration and profile columns present.

**Step 5: Commit**

```bash
git add supabase/migrations/20260304100000_add_sms_campaigns.sql supabase/migrations/20260305130000_add_sms_provider_profile_config.sql supabase/migrations/20260306110000_add_simple_sms_gateway_provider.sql
git commit -m "feat: add simple-sms-gateway schema support"
```

### Task 2: Add simple-sms-gateway provider adapter and factory support

**Files:**

- Create: `supabase/functions/sms-campaigns/providers/simple-sms-gateway-provider.ts`
- Modify: `supabase/functions/sms-campaigns/providers/mod.ts`
- Modify: `supabase/functions/sms-campaigns/providers/types.ts`
- Test: `supabase/functions/sms-campaigns/providers/simple-sms-gateway-provider.test.ts`

**Step 1: Write the failing test**

Create tests for:

- credentials validation rejects missing username/password
- send maps provider response to `SendSmsResult`
- factory creates provider for `simple-sms-gateway`

**Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/sms-campaigns/providers/simple-sms-gateway-provider.test.ts`
Expected: FAIL (missing provider implementation/factory branch).

**Step 3: Write minimal implementation**

Implement class similar to SMSGate adapter:

- constructor accepts `{ baseUrl, username, password }`
- `send({ to, from, body })` performs HTTP call and maps status/error
- static `isConfigured` optional only if env mode needed (not required for per-user)

Extend `createSmsProvider` union and switch:

```ts
type: "twilio" | "smsgate" | "simple-sms-gateway";
```

**Step 4: Run tests to verify pass**

Run: `deno test supabase/functions/sms-campaigns/providers/simple-sms-gateway-provider.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add supabase/functions/sms-campaigns/providers/simple-sms-gateway-provider.ts supabase/functions/sms-campaigns/providers/mod.ts supabase/functions/sms-campaigns/providers/types.ts supabase/functions/sms-campaigns/providers/simple-sms-gateway-provider.test.ts
git commit -m "feat: add simple-sms-gateway provider adapter"
```

### Task 3: Extend edge function provider status/config and validation

**Files:**

- Modify: `supabase/functions/sms-campaigns/index.ts`
- Test: `supabase/functions/sms-campaigns/index.provider-validation.test.ts`

**Step 1: Write failing tests for provider validation/status**

Cover:

- status includes simple-sms-gateway configured flag and metadata
- create/preview with `provider: "simple-sms-gateway"` fails when not configured
- create/preview succeeds validation when configured

**Step 2: Run tests to verify failure**

Run: `deno test supabase/functions/sms-campaigns/index.provider-validation.test.ts`
Expected: FAIL on missing fields/branches.

**Step 3: Write minimal implementation**

- Extend payload union to include `simple-sms-gateway`.
- Add profile config loaders/converters for simple-sms-gateway credentials.
- Extend `GET /providers/status` response.
- Add `POST /providers/simple-sms-gateway` endpoint.
- Update create/preview/process to validate and instantiate selected provider.

**Step 4: Run tests to verify pass**

Run:

- `deno test supabase/functions/sms-campaigns/index.provider-validation.test.ts`
- `deno test supabase/functions/sms-campaigns/utils/*.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add supabase/functions/sms-campaigns/index.ts supabase/functions/sms-campaigns/index.provider-validation.test.ts
git commit -m "feat: add simple-sms-gateway edge function support"
```

### Task 4: Update SMS composer provider UX

**Files:**

- Modify: `frontend/src/components/campaigns/SmsCampaignComposerDialog.vue`
- Test: `frontend/src/tests/unit/sms-campaign-composer-provider-options.test.ts`

**Step 1: Write failing unit test**

Test expected provider options and config guards:

- shows SMSGate + simple-sms-gateway always
- shows Twilio only when `twilioAvailable`
- submit/preview disabled when selected provider is not configured

**Step 2: Run test to verify it fails**

Run: `npm run test --prefix frontend -- --run src/tests/unit/sms-campaign-composer-provider-options.test.ts`
Expected: FAIL (provider missing).

**Step 3: Write minimal implementation**

- add `simple-sms-gateway` in `providerOptions`
- add form fields and computed config checks for simple-sms-gateway
- include provider-specific body payload for preview/create

**Step 4: Run tests to verify pass**

Run:

- `npm run test --prefix frontend -- --run src/tests/unit/sms-campaign-composer-provider-options.test.ts`
- `npm run lint --prefix frontend`

Expected: test PASS, lint no new errors.

**Step 5: Commit**

```bash
git add frontend/src/components/campaigns/SmsCampaignComposerDialog.vue frontend/src/tests/unit/sms-campaign-composer-provider-options.test.ts
git commit -m "feat: add simple-sms-gateway option in sms composer"
```

### Task 5: Add account settings panel for simple-sms-gateway

**Files:**

- Modify: `frontend/src/pages/account/settings.vue`
- Test: `frontend/src/tests/unit/account-sms-providers-settings.test.ts`

**Step 1: Write failing test**

Assert settings page renders and saves:

- SMSGate panel
- simple-sms-gateway panel
- correct endpoint calls per provider

**Step 2: Run test to verify failure**

Run: `npm run test --prefix frontend -- --run src/tests/unit/account-sms-providers-settings.test.ts`
Expected: FAIL (panel not present).

**Step 3: Write minimal implementation**

- add second config card/section for simple-sms-gateway
- wire save action to `/sms-campaigns/providers/simple-sms-gateway`
- maintain existing UX and translations style

**Step 4: Run tests to verify pass**

Run:

- `npm run test --prefix frontend -- --run src/tests/unit/account-sms-providers-settings.test.ts`
- `npm run lint --prefix frontend`

Expected: PASS, no new lint errors.

**Step 5: Commit**

```bash
git add frontend/src/pages/account/settings.vue frontend/src/tests/unit/account-sms-providers-settings.test.ts
git commit -m "feat: add simple-sms-gateway settings panel"
```

### Task 6: End-to-end verification for selected provider behavior

**Files:**

- Modify (if needed): `supabase/functions/sms-campaigns/index.ts`
- Modify (if needed): `frontend/src/components/campaigns/SmsCampaignComposerDialog.vue`

**Step 1: Write failing behavior checklist**

Expected:

- create campaign stores selected provider
- process endpoint uses same provider and records `provider_used`
- no fallback chain behavior occurs

**Step 2: Run verification commands**

Run:

- `npm run lint --prefix frontend`
- `deno test supabase/functions/sms-campaigns/utils/*.test.ts`
- targeted API smoke tests using local Supabase function serve

Expected: all pass and manual checks confirm provider-specific behavior.

**Step 3: Apply minimal fixes if any mismatch appears**

Keep changes scoped to provider selection and credential validation only.

**Step 4: Re-run verification**

Run same commands until clean.

**Step 5: Commit**

```bash
git add supabase/functions/sms-campaigns/index.ts frontend/src/components/campaigns/SmsCampaignComposerDialog.vue
git commit -m "fix: enforce manual provider selection across sms flow"
```

## Final validation checklist

- `provider` column supports all three providers.
- profile stores per-user credentials for SMSGate + simple-sms-gateway.
- status endpoint exposes all provider availability signals.
- composer + settings expose both per-user gateways and Twilio availability.
- campaign process uses selected provider only.
- no fallback chain in runtime logic.
