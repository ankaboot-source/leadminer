# Google Contacts OAuth Error: Structured Response + i18n

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plain-text 403 error from mining controller catch block with structured JSON and make frontend derive display message from `type` via i18n instead of using backend's error string.

**Architecture:** Two independent changes: (1) backend catch block returns `{error, type: "google"}` JSON instead of plain text, (2) frontend ignores backend's `error` field and uses i18n keys derived from `type` to generate the toast message.

**Tech Stack:** TypeScript (Express backend, Nuxt/Vue frontend), i18n JSON locale blocks

---

### Task 1: Backend — Return structured JSON for runtime 403 errors

**Files:**
- Modify: `backend/src/controllers/mining.controller.ts:469-478`

- [ ] **Step 1: Replace plain-text 403 response with structured JSON**

In `backend/src/controllers/mining.controller.ts`, replace lines 469-478:

```typescript
// BEFORE (lines 469-478):
if (
  err instanceof Error &&
  err.message.includes('Request failed with status code 403')
) {
  res
    .status(403)
    .send(
      'Failed to start Google contacts: Access denied. Please re-authenticate with Contacts permission.'
    );
}
```

With:

```typescript
// AFTER:
if (
  err instanceof Error &&
  err.message.includes('Request failed with status code 403')
) {
  logger.warn('Google Contacts API returned 403', {
    userId: user.id,
    email: sanitizedEmail
  });
  return res.status(403).json({
    error: 'Google Contacts: Access denied. Please re-authenticate with Contacts permission.',
    type: 'google'
  });
}
```

Key changes:
- Add `return` to prevent fallthrough to the 500 handler below
- Use `.json()` instead of `.send()`
- Add `logger.warn()` with userId and email context
- Include `type: 'google'` for frontend detection

- [ ] **Step 2: Run backend lint to verify no issues**

Run: `cd backend && npm run lint:fix && npm run prettier:fix`
Expected: No errors

- [ ] **Step 3: Run backend tests to verify no regressions**

Run: `cd backend && npm run test:unit`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/mining.controller.ts
git commit -m "fix: return structured JSON for Google Contacts 403 runtime error

Replace plain-text error response with {error, type: 'google'} JSON.
Add logger.warn() with userId context. Add return to prevent fallthrough."
```

---

### Task 2: Frontend — Use i18n message based on type, not backend error string

**Files:**
- Modify: `frontend/src/components/mining/stepper-panels/mine/MinePanel.vue:170-173`

- [ ] **Step 1: Remove backend error string usage from toast message**

In `frontend/src/components/mining/stepper-panels/mine/MinePanel.vue`, change lines 170-173:

```vue
// BEFORE (lines 170-173):
detail: {
  message:
    error.response._data.error ||
    t('google_contacts_permission_needed'),
```

With:

```vue
// AFTER:
detail: {
  message: t('google_contacts_permission_needed'),
```

The frontend now derives the display message entirely from i18n based on detecting `type: 'google'`. The backend's `error` field is informational only (for logs).

The i18n keys already exist from previous work:
- `en`: `"google_contacts_permission_needed": "Google Contacts requires your authorization."`
- `fr`: `"google_contacts_permission_needed": "Google Contacts nécessite votre autorisation."`

- [ ] **Step 2: Run frontend lint to verify no issues**

Run: `cd frontend && npm run lint:fix && npm run prettier:fix`
Expected: No errors

- [ ] **Step 3: Run frontend tests to verify no regressions**

Run: `cd frontend && npm run test -- --run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/mining/stepper-panels/mine/MinePanel.vue
git commit -m "fix: use i18n message for Google Contacts 403 instead of backend error string

Frontend now derives toast message from type field via i18n keys,
ignoring the backend's error field which is for logging only."
```

---

## Self-Review

### 1. Spec coverage

| Requirement | Task |
|---|---|
| Backend catch block returns structured JSON `{error, type: "google"}` | Task 1, Step 1 |
| Backend adds `return` to prevent fallthrough | Task 1, Step 1 |
| Backend adds `logger.warn()` with context | Task 1, Step 1 |
| Frontend doesn't use backend's `error` string | Task 2, Step 1 |
| Frontend uses i18n based on `type` | Task 2, Step 1 |
| i18n keys exist (en/fr) | Task 2, Step 1 (already present) |

### 2. Placeholder scan

No placeholders found. All code blocks contain actual content.

### 3. Type consistency

- `type: 'google'` is consistent between backend (Task 1) and frontend check `error.response?._data?.type === 'google'` (already in existing code at line 165)
- `logger.warn()` uses same pattern as existing logging in mining.controller.ts
- `res.status(403).json()` matches existing patterns in the same file (e.g., line 355, 386)

---

Plan complete and saved to `docs/superpowers/plans/2026-05-17-google-contacts-oauth-error-structured.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
