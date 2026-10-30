# ADR-003: Converge Supabase functions and migrations in the ops repo, with an rsync exclude list as the conflict contract

## Status

Accepted

## Date

Documented 2026-10-30; original decision date unrecovered (evidence clones are shallow).

## Context

The application repo (`leadminer`) and the commercial overlay repo (`leadminer-commercial`) both contain Supabase edge functions and migrations. The deployed stack is built from a third tree, `leadminer.io/supabase/`. There must be a deterministic rule for how source changes from two repos converge into the deploy tree.

## Decision

Supabase functions and migrations converge in `leadminer.io/supabase/{functions,migrations}`. The application repo syncs functions into the ops repo with `rsync` and explicitly excludes the commercial-owned paths. The sync never uses `--delete`. The commercial repo has its own sync path into the same tree, also without `--delete`.

The three excluded function paths are the commercial conflict contract:

- `billing/` — the whole billing edge-function tree.
- `email-campaigns/middlewares-mod.ts` — the commercial campaign middleware override.
- `mail/passive-mining-failed/template.ts` — the commercial failure-notification template.

Evidence anchors:

- `leadminer@469c7f8b:.github/workflows/push-supabase-functions.yml:22` — `rsync -av --exclude 'billing/' --exclude 'email-campaigns/middlewares-mod.ts' --exclude 'mail/passive-mining-failed/template.ts' supabase/functions/. leadminer.io/supabase/functions/`.
- `leadminer@469c7f8b:.github/workflows/push-supabase-migrations.yml:26` — `rsync -a supabase/migrations/ leadminer-io/supabase/migrations/` (no `--delete`).
- `leadminer-commercial@1840116:.github/workflows/push-supabase-functions.yml:22` — the commercial repo's own excluded-path sync.

## Alternatives considered

- A single shared Supabase tree owned by the application repo: rejected because the commercial overlay must stay out of the public repo.
- Delete-and-replace sync (`rsync --delete`): rejected because the ops tree holds files that are not in any source repo and would be silently removed.

## Consequences

- The ops `supabase/functions` tree is an append-only accumulation, not a clean union. At `leadminer.io@256a710` it holds 202 files, versus 189 in the app-plus-commercial union; 12 code files and `.env.prod` exist only in the ops tree. Migrations are an exact union: 121 = 115 app + 6 commercial.
- A function deleted in the app repo is still deployed from the ops repo until it is removed there as well. See [../runbooks/supabase-operations.md](../runbooks/supabase-operations.md) for the retirement procedure.
- The exclude list is the only conflict arbitration. Adding a new commercial-owned function requires adding it to the exclude list in the app repo's sync workflow as well.

## Related docs

- [../runbooks/supabase-operations.md](../runbooks/supabase-operations.md)
- [../platform/three-repo-model.md](../platform/three-repo-model.md)
