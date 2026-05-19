# Create PR: Google Contacts Sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a well-structured PR for the `feature/google-contacts-sync` branch with proper description, verification, and review checklist.

**Architecture:** The branch contains the full Google Contacts sync feature: OAuth integration, People API fetching, contact extraction with tagging engine, database migrations, and frontend UI changes. The PR needs a clear description, verification that all tests pass, and proper labeling.

**Tech Stack:** TypeScript (Express backend, Nuxt/Vue frontend, Deno edge functions), PostgreSQL/Supabase, Redis, Google People API

---

### Task 1: Pre-PR verification — lint, tests, build

**Files:** No file changes — verification only

- [ ] **Step 1: Run backend lint**

Run: `cd backend && npm run lint:fix && npm run prettier:fix`
Expected: No lint errors

- [ ] **Step 2: Run backend tests**

Run: `cd backend && npm run test:unit`
Expected: All tests pass (593+)

- [ ] **Step 3: Run frontend lint**

Run: `cd frontend && npm run lint:fix && npm run prettier:fix`
Expected: No lint errors

- [ ] **Step 4: Run frontend tests**

Run: `cd frontend && npm run test -- --run`
Expected: All tests pass

- [ ] **Step 5: Run backend build**

Run: `cd backend && npm run build`
Expected: TypeScript compiles without errors

- [ ] **Step 6: Run emails-fetcher lint**

Run: `cd micro-services/emails-fetcher && npm run lint && npm run prettier:fix`
Expected: No lint errors

---

### Task 2: Create PR description and open PR

**Files:** No file changes — PR creation via `gh pr create`

- [ ] **Step 1: Create PR using gh CLI**

Run from: `/home/cyber/Desktop/leadminer/.worktrees/google-contacts-sync`

```bash
gh pr create \
  --base main \
  --head feature/google-contacts-sync \
  --title "feat: Google Contacts sync during email mining" \
  --body "$(cat <<'EOF'
## Summary

- Google Contacts sync integrated into email mining pipeline: when enabled, contacts are fetched from Google People API and merged with email-extracted contacts
- Tagging engine applied to Google Contacts using email-based analysis (no headers), with default `newsletter`/`NONE` fallback for untaggable contacts
- Structured 403 error handling for missing OAuth permissions: backend returns `{error, type: "google"}`, frontend shows `has-links` toast with "Authorize" button
- Database: `contacts_view` updated to work with merged sources, new `google-contacts-fetch` task type, `merge_contact_sources` migration
- Frontend: source column displays as badges array, OAuth consent sidebar integration for re-authorization

## Changes by Area

### Backend
- **`GoogleContactsExtractor.ts`** — Extracts contacts from Google People API format, applies tagging engine with email-based analysis
- **`GoogleContactsFetchTask.ts`** — Pipeline task that fetches Google Contacts and publishes to Redis stream
- **`googlePeopleClient.ts`** — Google People API client with batch sync support
- **`mining.controller.ts`** — OAuth validation: returns structured 403 when `googleContactsSync` enabled but no credentials; runtime 403 handler returns structured JSON
- **`PgContacts.ts`** — `createFromGoogleContacts()` method with UPSERT_PERSON_SQL, alternate_name/alternate_email support
- **`factories.ts`** — `createImapMining()` adds `GoogleContactsFetchTask` when `googleContactsSync && credentials`
- **`emailMessageHandlers.ts`** — Handles `google-contacts` extraction result type
- **`Extractor.ts`** — Factory supports new extractor types

### Frontend
- **`MinePanel.vue`** — 403 Google Contacts error handling with `has-links` toast + authorize button
- **`MiningTable.vue`** — Source column displays as badges array
- **`MiningSettingsDialog.vue`** — Google Contacts sync toggle
- **`leadminer.ts`** — Store handles Google Contacts sync state
- **`contact.ts` / `database.types.ts`** — Updated types for sources array, mining_id

### Database
- **`20260514120000_merge_contact_sources.sql`** — Migrate contacts_view to work with merged sources
- **`20260512160000_add_google_contacts_fetch_to_task_type_enum.sql`** — Add `google-contacts-fetch` task type
- **`20251016215841_add_mining_id.sql`** — (existing) mining_id column support

### Microservice
- **`emails-fetcher`** — Google Contacts fetcher client, `googlePeopleClient.ts`, API endpoint for `startGoogleContactsSync`

## Testing

- All 593+ backend unit tests pass
- All frontend Vitest tests pass
- New tests: `GoogleContactsExtractor.test.ts`, `GoogleContactsFetchTask.test.ts`, `PipelineSequential.test.ts`

## Key Decisions

- Tag source format: `google_contacts#email_address` (not `google-contacts:${userEmail}`)
- Default tag when engine returns empty: `{name: 'newsletter', reachable: REACHABILITY.NONE}` — filtered from verification queue
- `person.source` stays as `google-contacts:${userEmail}` — identifies extraction origin, not tag source
- OAuth scope `https://www.googleapis.com/auth/contacts` required for Google mining source
EOF
)"
```

Expected: PR created, URL returned

- [ ] **Step 2: Verify PR was created**

Run: `gh pr view --json state,number,url`
Expected: PR state is `OPEN`, URL is valid

---

## Self-Review

### 1. Spec coverage

| Requirement | Task |
|---|---|
| Verify lint passes | Task 1, Steps 1, 3, 6 |
| Verify tests pass | Task 1, Steps 2, 4 |
| Verify build passes | Task 1, Step 5 |
| Create PR with description | Task 2, Step 1 |
| Verify PR created | Task 2, Step 2 |

### 2. Placeholder scan

No placeholders found. All steps contain actual commands and expected output.

### 3. Type consistency

N/A — this plan is about PR creation, not code changes.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-17-create-pr-google-contacts-sync.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
