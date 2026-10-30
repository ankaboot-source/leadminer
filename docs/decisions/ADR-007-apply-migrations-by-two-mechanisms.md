# ADR-007: Apply migrations by two different mechanisms per environment

## Status

Accepted

## Date

Documented 2026-10-30; original decision date unrecovered (evidence clones are shallow).

## Context

QA and prod both need the same migration files applied, but the two environments have different connectivity constraints and different failure histories. QA runs migrations on a push to `supabase/migrations/**`; prod runs them on a `trigger-prod` dispatch or a manual run.

## Decision

Each environment applies migrations with its own mechanism.

**QA** uses a shell loop over the sorted migration files. For each file it derives the version from the filename prefix, checks the history table, skips when the version exists, otherwise runs `psql -v ON_ERROR_STOP=1 -f`, then inserts a history row with `statements = '{}'`.

**Prod** uses the Supabase CLI: `supabase db push --db-url ... --include-all --debug`, preceded by the guarded history repairs described in [ADR-006](./ADR-006-tolerate-out-of-order-cross-repo-migration-versions.md).

Evidence anchors:

- `leadminer.io@256a710:.github/workflows/supabase-migrations-qa.yml:127-143` — the `for f in $(ls supabase/migrations/*.sql | sort)` loop, the existence check, the `psql -f`, and the `INSERT ... statements = '{}'`.
- `leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:103-108` — `supabase db push --db-url $SUPABASE_DB_URL --include-all --debug`.

## Alternatives considered

- Use `supabase db push` in both environments: rejected for QA because QA applies a single migration file at a time over a direct `psql` connection that the workflow exposes through a temporary firewall rule.
- Use the `psql` loop in prod: rejected because the prod history needs the `--include-all` out-of-order handling and the CLI records richer history metadata.

## Consequences

- QA history rows carry empty `statements` arrays; prod history rows are CLI-managed. A schema-history query that assumes a populated `statements` column is wrong on QA.
- The two mechanisms fail differently. A QA loop stops at the first failing `psql` invocation; a prod `db push` applies migrations until one fails and reports the failure.
- A migration that is valid in one environment can be invalid in the other if it depends on environment-specific extensions or roles. Test migrations against both mechanisms before promoting.
- Prod relies on non-interactive acceptance of the CLI's confirmation prompt. A CLI version that changes the prompt behaviour can block the workflow.

## Related docs

- [../runbooks/supabase-operations.md](../runbooks/supabase-operations.md)
- [../runbooks/deploy.md](../runbooks/deploy.md)
