# ADR-006: Tolerate out-of-order, cross-repo migration versions via `--include-all` plus a guarded history repair

## Status

Accepted

## Date

Documented 2026-10-30; original decision date unrecovered (evidence clones are shallow).

## Context

Two source repos, `leadminer` and `leadminer-commercial`, contribute migrations to one `supabase_migrations.schema_migrations` history table in the ops repo and on the target database. The migrations are an exact union at the time of writing: 121 files in the ops repo = 115 app migrations + 6 commercial migrations. Because the two repos are merged by `rsync`, their versions interleave, and the prod database history can be older than the file set.

Two concrete history defects exist on prod: a stale row recorded under the placeholder name `20241206143825`, and a row for `20260327000000_add_sms_fleet_mode` that was marked applied without its SQL running.

## Decision

Prod migrations are applied with `supabase db push --include-all`, and the migration workflow performs two guarded history repairs immediately before the push:

1. Delete the `20241206143825` row only when its `name` matches `%placeholder%`.
2. Delete the `20260327000000` row only when the `private.sms_fleet_gateways` table does not exist.

Both repairs are gated on the history table existing at all, so a brand-new database takes the no-repair path.

Evidence anchors:

- `leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:96-99` — the `information_schema.tables` guard and the two conditional `DELETE` statements.
- `leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:106-108` — the `--include-all` comment and `supabase db push --db-url $SUPABASE_DB_URL --include-all --debug`.

## Alternatives considered

- Strict version ordering without `--include-all`: rejected because the commercial migration set contains versions older than the app's newest applied migration, so a strict push refuses to run.
- Manual history edits by an operator: rejected because the two known repairs are deterministic and repeatable; a manual step would be forgotten on the next environment.
- Dropping and recreating the history table: rejected because it would re-apply already-applied DDL.

## Consequences

- `supabase db push` must not be run without `--include-all` on prod. A strict push will fail or skip out-of-order migrations.
- The two repair `DELETE` statements are deliberately conditioned so they cannot fire twice: once the placeholder row is gone and the SMS fleet table exists, both statements match zero rows permanently.
- A migration that is genuinely out of order and not idempotent can still fail mid-push. The push is not transactional across the whole set; Supabase applies each migration and records it individually.
- The QA environment does not use this mechanism. QA uses a `psql -f` loop with a manual history insert (see [ADR-007](./ADR-007-apply-migrations-by-two-mechanisms.md)).

## Related docs

- [../runbooks/supabase-operations.md](../runbooks/supabase-operations.md)
- [../runbooks/deploy.md](../runbooks/deploy.md)
