# Campaign Dialog UX Fixes - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix CampaignComposerDialog to keep dialog open and show proper dialogs (not toasts) for 402/266 responses, add plural i18n support in ComplianceDialog, and remove duplicate ref.

**Architecture:** Refactor error handling in submit function to distinguish between actual errors (show toast) and expected user confirmation flows (show dialog, keep form open). Use Vue i18n pluralization for contact counts.

**Tech Stack:** Vue 3, TypeScript, Vue I18n, PrimeVue Dialog

---

## Current Issues

### Issue 1: Dialog Closes on 402/266

**File:** `CampaignComposerDialog.vue`
**Problem:** When 402 (no credits) or 266 (partial consent/credits) response received:

- Code throws error at line 1124
- `isVisible.value = false` executes at line 1145
- Error caught and toast shown
- Dialog closes, user loses form data

### Issue 2: Local Ref Duplicates Import

**File:** `CampaignComposerDialog.vue` (line ~416)
**Problem:** Defines local `CreditsDialogCampaignRef` but should use imported one from `credits.ts`

### Issue 3: Missing Plural i18n

**File:** `ComplianceDialog.vue`
**Problem:** Messages like "1 contacts" instead of "1 contact" due to missing plural handling

---

## Task 1: Remove Local CreditsDialogCampaignRef

**Files:**

- Modify: `frontend/src/components/campaigns/CampaignComposerDialog.vue:416-418`

**Step 1: Remove local ref definition**

Find and remove:

```typescript
const CreditsDialogCampaignRef = ref<InstanceType<typeof CreditsDialog> | null>(
  null,
);
```

**Step 2: Verify import exists**

Ensure this import is present (should already be there):

```typescript
import {
  CreditsDialog,
  CreditsDialogCampaignRef,
  openCreditsDialog,
} from "@/utils/credits";
```

**Step 3: Commit**

```bash
git add frontend/src/components/campaigns/CampaignComposerDialog.vue
git commit -m "refactor: remove local CreditsDialogCampaignRef, use imported ref"
```

---

## Task 2: Fix Error Handling for 402/266 Responses

**Files:**

- Modify: `frontend/src/components/campaigns/CampaignComposerDialog.vue:1097-1162`

**Step 1: Refactor submit function structure**

Current problematic flow:

```typescript
async function submit(partialCampaign = false) {
  try {
    const data = await $saasEdgeFunctions(...);
    // ... onResponse handles 402/266 but then throws error

    $toast.add({...success...});  // Line 1128
    isVisible.value = false;       // Line 1145 - closes dialog
  } catch (error) {
    $toast.add({...error...});     // Shows error toast
  }
}
```

**Step 2: Implement new flow**

Change to track if we should show error/close:

```typescript
async function submit(partialCampaign = false) {
  let shouldClose = true;
  let showError = true;

  try {
    const data = await $saasEdgeFunctions('email-campaigns/campaigns/create', {
      // ... body
      onResponse: ({ response }) => {
        // Handle 402 (no credits) - show CreditsDialog, don't close
        if (response.status === 402) {
          openCreditsDialog(
            CreditsDialogCampaignRef,
            true, // hasDeficientCredits
            response._data.total,
            response._data.available,
            response._data.availableAlready,
          );
          shouldClose = false;
          showError = false;
          return;
        }

        // Handle 266 with credits reason - show CreditsDialog with partial option
        if (response.status === 266 && response._data?.reason === 'credits') {
          openCreditsDialog(
            CreditsDialogCampaignRef,
            false, // hasDeficientCredits = false (has some credits)
            response._data.total,
            response._data.available,
            response._data.availableAlready,
          );
          shouldClose = false;
          showError = false;
          return;
        }

        // Handle 266 with consent reason - show ComplianceDialog
        if (response.status === 266 && response._data?.reason === 'consent') {
          complianceDialogRef.value?.openModal(
            response._data.total,
            response._data.available,
          );
          shouldClose = false;
          showError = false;
          return;
        }

        // Success
        if (response.status === 200) {
          return;
        }

        // Other errors - let catch block handle
        throw new Error(response._data?.error || 'Campaign creation failed');
      },
    });

    // Only show success and close if we should
    if (shouldClose) {
      $toast.add({
        severity: 'success',
        summary: t('campaign_started'),
        detail: {...},
        life: 6000,
      });

      if (data?.campaignId) {
        startCampaignCompletionWatcher(data.campaignId);
      }

      isVisible.value = false;
    }
  } catch (error: unknown) {
    // Only show error toast if it's not a handled 402/266
    if (showError) {
      const parsedError = error as EdgeResponseError;
      const code = parsedError?.data?.code;
      if (code === 'SENDER_SMTP_FAILED' && fallbackSenderEmail.value) {
        form.senderEmail =
          parsedError?.data?.fallbackSenderEmail || fallbackSenderEmail.value;
      }

      $toast.add({
        severity: 'error',
        summary: t('campaign_start_failed'),
        detail: resolveErrorMessage(error, 'error_campaign_start_failed'),
        life: 5000,
      });
    }
  } finally {
    isSubmitting.value = false;
  }
}
```

**Step 3: Verify flow logic**

- 402 → CreditsDialog opens (refill mode), form stays open, no toast
- 266 + credits → CreditsDialog opens (partial mode), form stays open, no toast
- 266 + consent → ComplianceDialog opens, form stays open, no toast
- 200 → Success toast, dialog closes
- Other errors → Error toast, form stays open

**Step 4: Commit**

```bash
git add frontend/src/components/campaigns/CampaignComposerDialog.vue
git commit -m "fix: keep dialog open for 402/266 responses, show proper dialogs"
```

---

## Task 3: Add Plural i18n Support in ComplianceDialog

**Files:**

- Modify: `frontend/src/components/campaigns/ComplianceDialog.vue:66-83`

**Step 1: Update i18n messages with plural support**

Change from:

```json
{
  "en": {
    "consent_message": "Only {available} of {total} contacts have given consent.",
    "continue_with_available": "Continue with {count} contacts"
  }
}
```

To:

```json
{
  "en": {
    "consent_message": "Only {available} of {total} {total} have given consent to be contacted.",
    "contact": "contact | contacts",
    "continue_with_available": "Continue with {count} {count}"
  },
  "fr": {
    "consent_message": "Seulement {available} sur {total} {total} ont donné leur consentement.",
    "contact": "contact | contacts",
    "continue_with_available": "Continuer avec {count} {count}"
  }
}
```

**Step 2: Update template to use pluralization**

Change line 4 from:

```vue
{{ t("consent_message", { available, total }) }}
```

To:

```vue
{{ t("consent_message", { available, total: t("contact", total) }) }}
```

Change line 19 from:

```vue
:label="t('continue_with_available', { count: available })"
```

To:

```vue
:label="t('continue_with_available', { count: t('contact', available) })"
```

**Step 3: Verify pluralization works**

Test scenarios:

- available=1, total=5 → "Only 1 of 5 contacts..." / "Continue with 1 contact"
- available=1, total=1 → "Only 1 of 1 contact..." / "Continue with 1 contact"
- available=3, total=10 → "Only 3 of 10 contacts..." / "Continue with 3 contacts"

**Step 4: Commit**

```bash
git add frontend/src/components/campaigns/ComplianceDialog.vue
git commit -m "feat: add plural i18n support for contact counts"
```

---

## Task 4: Test User Flows

**Files:**

- Test manually in browser

**Step 1: Test 402 flow (no credits)**

1. Select contacts with 0 credits available
2. Click "Send campaign"
3. Verify:
   - CreditsDialog opens with "Refill" button
   - No error toast shown
   - CampaignComposerDialog stays open
   - Form data preserved

**Step 2: Test 266 flow with credits (partial available)**

1. Select 10 contacts with only 5 credits available
2. Click "Send campaign"
3. Verify:
   - CreditsDialog opens with "Send only 5" button
   - No error toast shown
   - CampaignComposerDialog stays open
   - Clicking "Send only 5" submits partial campaign
   - Dialog closes on success

**Step 3: Test 266 flow with consent (partial consent)**

1. Select contacts where some opted out
2. Click "Send campaign"
3. Verify:
   - ComplianceDialog opens
   - No error toast shown
   - CampaignComposerDialog stays open
   - Shows "Only X of Y contacts have given consent"
   - Pluralization correct ("1 contact" vs "2 contacts")
   - Clicking "Continue" submits partial campaign

**Step 4: Test success flow**

1. Select contacts with sufficient credits and consent
2. Click "Send campaign"
3. Verify:
   - Success toast shown
   - Dialog closes
   - Campaign created

**Step 5: Test error flow**

1. Trigger error (e.g., invalid sender)
2. Verify:
   - Error toast shown
   - Dialog stays open
   - Form data preserved

---

## Summary

After completing all tasks:

1. **No duplicate refs** - Uses imported CreditsDialogCampaignRef
2. **Proper dialog handling** - 402/266 show dialogs, not toasts
3. **Dialog stays open** - Form preserved for user confirmation flows
4. **Plural i18n** - Correct "contact/contacts" based on count
5. **Clear UX** - User knows what to do (refill, send partial, or cancel)

The flow now matches user expectations:

- Insufficient resources → Dialog with options → User chooses → Action taken
- Not: Error → Dialog closes → Lose work → Confusion
