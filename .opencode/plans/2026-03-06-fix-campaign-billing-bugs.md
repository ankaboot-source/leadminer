# Fix Campaign Billing Integration Bugs - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three critical bugs: middleware logic error for 402 responses, duplicate type definition syntax error, and missing CreditsDialog integration in CampaignComposerDialog.

**Architecture:** Fix middleware to properly check billing quota availability, remove duplicate type declaration causing syntax errors, and integrate CreditsDialog component following the same pattern as ExportContacts.vue for partial campaign support.

**Tech Stack:** TypeScript/Deno (backend), Vue/Nuxt (frontend), Hono middleware

---

## Bug Analysis

### Bug 1: Middleware Logic Error

**File:** `supabase/functions/email-campaigns/campaign-check-middleware.ts`
**Line:** 112
**Issue:** Current check is `if (!data?.hasCredits)` but should check `if (!data?.hasCredits && !data?.available)` to properly return 402 when user has zero credits.

### Bug 2: Duplicate Type Definition

**File:** `frontend/src/components/campaigns/CampaignComposerDialog.vue`
**Lines:** 358 and 406
**Issue:** `type SenderOptionItem` is defined twice causing syntax error. The first definition at line 358 is incomplete.

### Bug 3: Missing CreditsDialog Integration

**File:** `frontend/src/components/campaigns/CampaignComposerDialog.vue`
**Issues:**

- Missing CreditsDialog component in template
- Using `openCreditsDialog(null, ...)` instead of proper ref-based approach
- Missing secondary action handler for partial campaign
- Need to add CreditsDialogCampaignRef ref like in ExportContacts.vue

---

## Task 1: Fix Middleware Logic for 402 Response

**Files:**

- Modify: `supabase/functions/email-campaigns/campaign-check-middleware.ts:112`
- Test: `supabase/functions/email-campaigns/tests/campaign-check-middleware.test.ts`

**Step 1: Update the credit check logic**

Change line 112 from:

```typescript
if (!data?.hasCredits) {
```

To:

```typescript
if (!data?.hasCredits && !data?.available) {
```

**Step 2: Add test for zero credits scenario**

In `campaign-check-middleware.test.ts`, add test:

```typescript
Deno.test({
  name: "campaign-check-middleware: should return 402 when hasCredits is false and available is 0",
  async fn() {
    // Test implementation
  },
});
```

**Step 3: Run tests to verify fix**

Run: `cd supabase/functions/email-campaigns && deno test tests/ --no-check --allow-env`
Expected: All tests pass including new test

**Step 4: Commit**

```bash
git add supabase/functions/email-campaigns/campaign-check-middleware.ts
git add supabase/functions/email-campaigns/tests/campaign-check-middleware.test.ts
git commit -m "fix: correct billing quota check logic for 402 response"
```

---

## Task 2: Remove Duplicate Type Definition

**Files:**

- Modify: `frontend/src/components/campaigns/CampaignComposerDialog.vue:358-359`

**Step 1: Remove the incomplete type definition at line 358**

Find and remove:

```typescript
type SenderOptionItem = {
```

**Step 2: Verify the complete type definition exists at line 406**

Ensure this remains:

```typescript
type SenderOptionItem = {
  email: string;
  label: string;
};
```

**Step 3: Verify no TypeScript errors**

Run: `cd frontend && npm run typecheck` or `npx vue-tsc --noEmit`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add frontend/src/components/campaigns/CampaignComposerDialog.vue
git commit -m "fix: remove duplicate SenderOptionItem type definition"
```

---

## Task 3: Integrate CreditsDialog in CampaignComposerDialog

**Files:**

- Modify: `frontend/src/components/campaigns/CampaignComposerDialog.vue`

**Step 1: Import CreditsDialog and create ref**

Add to imports (around line 356):

```typescript
import {
  CreditsDialog,
  CreditsDialogCampaignRef,
  openCreditsDialog,
} from "@/utils/credits";
```

Add ref (around line 414):

```typescript
const CreditsDialogCampaignRef = ref<InstanceType<typeof CreditsDialog> | null>(
  null,
);
```

**Step 2: Add CreditsDialog component to template**

Add before the closing `</template>` tag (around line 343):

```vue
<component
  :is="CreditsDialog"
  ref="CreditsDialogCampaignRef"
  engagement-type="contact"
  action-type="campaign"
  @secondary-action="submit(true)"
/>
```

**Step 3: Update openCreditsDialog call**

Change line 1087-1094 from:

```typescript
openCreditsDialog(
  null,
  response.status === 402,
  response._data.total,
  response._data.available,
  response._data.availableAlready,
);
```

To:

```typescript
openCreditsDialog(
  CreditsDialogCampaignRef,
  response.status === 402,
  response._data.total,
  response._data.available,
  response._data.availableAlready,
);
```

**Step 4: Update submit button to call submit(false)**

Find the submit button and ensure it calls:

```typescript
@click="submit(false)"
```

**Step 5: Verify imports are correct**

Check that `@/utils/credits` exports:

- CreditsDialog
- CreditsDialogCampaignRef
- openCreditsDialog

**Step 6: Run frontend type check**

Run: `cd frontend && npm run typecheck`
Expected: No TypeScript errors

**Step 7: Commit**

```bash
git add frontend/src/components/campaigns/CampaignComposerDialog.vue
git commit -m "feat: integrate CreditsDialog with partial campaign support"
```

---

## Task 4: Update CreditsDialog Types if Needed

**Files:**

- Check: `frontend/src/utils/credits.ts`

**Step 1: Verify CreditsDialogCampaignRef exists**

Check if `credits.ts` exports `CreditsDialogCampaignRef`. If not, add:

```typescript
export const CreditsDialogCampaignRef = ref<InstanceType<
  NonNullable<typeof CreditsDialog>
> | null>();
```

**Step 2: Verify CreditsDialog component supports action-type="campaign"**

Check CreditsDialog.vue props to ensure `actionType` accepts "campaign" value.

**Step 3: Commit if changes made**

```bash
git add frontend/src/utils/credits.ts
git commit -m "fix: add CreditsDialogCampaignRef export for campaign dialog"
```

---

## Task 5: Test Integration

**Files:**

- Test manually via browser or curl

**Step 1: Start local dev environment**

Run: `npm run dev:all`
Wait for: All services healthy

**Step 2: Test partial campaign flow**

1. Select more contacts than available credits
2. Click "Send campaign"
3. Verify CreditsDialog opens with "Send only X" button
4. Click "Send only X" button
5. Verify campaign is created with partial contacts

**Step 3: Test insufficient credits flow**

1. Select contacts when user has 0 credits
2. Click "Send campaign"
3. Verify 402 response triggers CreditsDialog
4. Verify "Refill credits" button appears
5. Verify partial action button is hidden

**Step 4: Test consent filter flow**

1. Select contacts with some opted out
2. Click "Send campaign"
3. Verify ComplianceDialog opens for consent confirmation
4. Confirm partial campaign
5. Verify only consented contacts are used

---

## Summary

After completing all tasks:

1. **Middleware** correctly returns 402 when `hasCredits=false` and `available=0`
2. **TypeScript** compiles without duplicate type definition errors
3. **CreditsDialog** integrates properly with partial campaign support
4. **User flow** works: insufficient credits → dialog → partial campaign or refill

The integration follows the same pattern as ExportContacts.vue for consistency.
