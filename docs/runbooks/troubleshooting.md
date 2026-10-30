# Troubleshooting

> Use this runbook to look up a known symptom and its action, or to reach the runbook that owns the failing layer.

## When to use this

- An API or UI action fails with a known error code or message.
- A deploy succeeds but a feature is broken.
- An edge function returns 500.
- A local end-to-end run fails before it reaches the product.

## Preconditions

- Access to the affected environment's logs (see [./incident-response.md](./incident-response.md)).
- For local reproduction: the app repo at `leadminer@469c7f8b`.

## Symptom to action

Rows tagged `[session-derived]` come from recovered maintainer sessions (L4). They describe observed symptoms and fixes, not guaranteed behaviour. Always confirm the current code before relying on a fix.

| ID                      | Symptom                                                                                                                                                                                             | Action                                                                                                                                                                                                                     | Runbook                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| FM-1 [session-derived]  | Campaign send fails with `Unable to fetch contacts for campaign: Could not find the function private.get_contacts_table_by_ids(p_ids, p_user_id) in the schema cache`, code `CONTACTS_FETCH_FAILED` | Apply the missing migration, then reload PostgREST with `NOTIFY pgrst, 'reload schema';` or restart `rest`. Check the requested signature against the migration-defined argument order.                                    | [./supabase-operations.md](./supabase-operations.md#procedure-reload-the-postgrest-schema-cache) |
| FM-2 [session-derived]  | Edge function returns 500 and the worker boot fails with `SyntaxError: ... env-helpers.ts does not provide an export named 'getOptionalEnv'`                                                        | The importing function and `_shared/env-helpers.ts` did not land together. Re-sync the functions from the source repo and redeploy so both are copied.                                                                     | [./supabase-operations.md](./supabase-operations.md#procedure-deploy-an-edge-function)           |
| FM-3 [session-derived]  | QA user deletion shows `Oops! Failed to delete user data`                                                                                                                                           | `private.delete_user_data` changed signature across migrations (a `user_id uuid` variant versus the no-argument `auth.uid()` variant). Confirm the migration state on the target database and apply the missing migration. | [./deploy.md](./deploy.md#5-database-migrations)                                                 |
| FM-4 [session-derived]  | Passive-mining cron logs `[Error] Error starting mining for source <x>: Error: Unauthorized`                                                                                                        | The edge-function-to-backend call authenticates with `Authorization: Bearer <service key>`; the backend expects the matching header. Align the header with the backend route's validation.                                 | [./incident-response.md](./incident-response.md)                                                 |
| FM-5 [session-derived]  | Passive mining scans the whole inbox instead of the last mined message                                                                                                                              | No persisted watermark means a full-scan bootstrap. The incremental path uses a per-folder UID watermark; a date-only `since` scan cannot advance the cursor.                                                              | [./supabase-operations.md](./supabase-operations.md)                                             |
| FM-6 [session-derived]  | With signatures enabled, the incremental fetch path asserts on `seqRange`                                                                                                                           | `ImapEmailsFetcher.fetchWithBody` expects a sequence range, but the incremental path is UID-based. Align the call or the job kind.                                                                                         | [./supabase-operations.md](./supabase-operations.md)                                             |
| FM-7 [session-derived]  | HTML entities in body text are partially decoded                                                                                                                                                    | `html-entities` needs `{ scope: 'attribute' }` to decode legacy no-semicolon entities correctly. Use `scope: 'attribute'` in the edge and frontend helpers and add a regression test.                                      | [./deploy.md](./deploy.md)                                                                       |
| FM-8 [session-derived]  | Local end-to-end run fails at browser launch                                                                                                                                                        | Chrome sandbox requires `--args "--no-sandbox"` on the first `open`.                                                                                                                                                       | This document, below                                                                             |
| FM-9 [session-derived]  | Local end-to-end run fails at IMAP/TLS                                                                                                                                                              | A local MITM proxy produces a null certificate subject; `checkServerIdentity` fails. Bypass the identity check for local runs only; production OAuth connections already use `rejectUnauthorized: false`.                  | This document, below                                                                             |
| FM-10 [session-derived] | Signature extraction uses the wrong model                                                                                                                                                           | The OSS backend selects from the `:free` OpenRouter models defined in `backend/src/services/signature/llm/types.ts`. Confirm the active model list before debugging extraction quality.                                    | [./deploy.md](./deploy.md)                                                                       |
| FM-11 [session-derived] | Transactional contacts reappear in the contacts table                                                                                                                                               | Two divergent `contacts_view` fixes exist (a `NOT EXISTS` tag filter versus `m.email IS NULL`). Reconcile the branch and `main` before trusting either.                                                                    | This document, below                                                                             |

## Specific symptom deep-dives

### `CONTACTS_FETCH_FAILED` and the PostgREST schema cache

This is FM-1. The error means PostgREST cannot resolve the function, not that the campaign code is wrong. There are two causes: the migration that defines `private.get_contacts_table_by_ids` did not run on the target database, or the migration ran but PostgREST's cache is stale.

Apply the migration first, then reload the cache. Do not restart the whole stack; restart `rest` or run the `NOTIFY`. [session-derived] [verified supabase-selfhost-ops@56638b9:AGENTS.md:146]

### Edge-function 500 from a stale `_shared/env-helpers.ts`

This is FM-2. The server deploy copies the whole function tree, so a helper and its importers should land together. A stale helper usually means the sync excluded the file or the deploy ran against a tree that was not re-synced after the import was added. Re-run the function deploy and confirm `_shared/env-helpers.ts` on the server exports the symbol the caller imports. [session-derived] [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-qa.yml:64-67]

### `delete_user_data` signature drift

This is FM-3. The RPC changed across migrations. Confirm the signature on the target database (`\df private.delete_user_data`) and apply the migration that matches the calling convention. The `psql` entry point in [./deploy.md](./deploy.md#5-database-migrations) is the supported way to apply it. [session-derived]

### Passive-mining `Unauthorized` header mismatch

This is FM-4. The cron worker calls the backend with a service-role bearer token; the backend route validates a specific header. Compare the edge function's outgoing header with the backend route's guard, then align the edge function (the preferred fix) rather than loosening the backend auth. [session-derived]

### `html-entities` and `scope: 'attribute'`

This is FM-7. Legacy entities without a trailing semicolon decode differently under `scope: 'body'`. Use `scope: 'attribute'` in both the edge helper and the frontend helper, and add a regression test with a sample legacy entity. [session-derived]

### Local end-to-end quirks

- **Browser sandbox.** The local Chrome launch needs `--args "--no-sandbox"`; pass it on the first `open`. The daemon may print a warning. [session-derived]
- **Local IMAP TLS.** A local MITM proxy yields a null certificate subject and Node's `checkServerIdentity` fails. Bypass the identity check for local runs only. Production OAuth connections already set `rejectUnauthorized: false`. [session-derived]
- **Operating system.** Do not assume Ubuntu semantics for `apt`/`dpkg` on the local machine; the recovered sessions were run on a rolling distribution. [session-derived]

### Conflicting `contacts_view` fixes

This is FM-11. Two fixes exist:

- A branch filter using `NOT EXISTS tags source = 'refined#email_address'`.
- A `main` filter using `m.email IS NULL`.

Reconcile the two before trusting either. Reproduce the symptom against the current `main` view definition, then choose one predicate and delete the other. [session-derived]

## Verification

- After a PostgREST reload, the failing RPC resolves and the original action completes.
- After a function re-sync, the function returns a non-500 response for a known-good request.
- After a migration, the history row exists for the expected version.
- After a local E2E fix, the suite reaches the product assertion rather than the harness assertion.

## Rollback

See [./rollback.md](./rollback.md). Most rows here are fix-forward: the edge-function and frontend layers have no versioned rollback.

## Related docs

- [./incident-response.md](./incident-response.md)
- [./deploy.md](./deploy.md)
- [./supabase-operations.md](./supabase-operations.md)
- [./rollback.md](./rollback.md)
