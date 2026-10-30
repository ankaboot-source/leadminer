# ADR-008: Render the Supabase stack from `supabase-selfhost-ops` and mutate its templates in place at deploy time

## Status

Accepted

## Date

Documented 2026-10-30; original decision date unrecovered (evidence clones are shallow).

## Context

The Supabase stack (Postgres, GoTrue, PostgREST, Realtime, Storage, Edge Functions, Studio, the API gateway and the supporting roles) is distributed by the public `supabase-selfhost-ops` repo. Leadminer's deployment needs several settings that differ from that repo's defaults: a `private` PostgREST schema, a larger row cap, a different auth hook path, custom mailer template URLs, Postgres tuning, a different data volume path and a reduced Ansible role set.

## Decision

The Supabase stack workflows clone `supabase-selfhost-ops`, render a custom `env/supabase.yml` from its template plus injected secrets, then mutate the repo's templates in place on the deploy host. The mutations are not committed back anywhere. The deployed configuration exists only on the server and in the workflow script.

The overrides applied by `deploy-supabase-stack-qa.yml` are:

1. `PGRST_DB_SCHEMAS=private,storage,graphql_public` (replaces the public-schema default).
2. `PGRST_DB_MAX_ROWS=100000` (replaces `1000`).
3. `PGRST_DB_EXTRA_SEARCH_PATH=private` (replaces `public`).
4. `pg-functions://postgres/private/custom_access_token_hook` (replaces the public-schema hook path).
5. Five `MAILER_TEMPLATES_*` URL rewrites pointing at the storage `templates` bucket.
6. Sixteen Postgres tuning flags injected into the compose template (`max_connections=500`, `shared_buffers=768MB`, `effective_cache_size=2304MB`, `maintenance_work_mem=384MB`, `checkpoint_completion_target=0.9`, `wal_buffers=16MB`, `default_statistics_target=500`, `random_page_cost=1.1`, `effective_io_concurrency=200`, `work_mem=8MB`, `huge_pages=off`, `min_wal_size=4GB`, `max_wal_size=16GB`).
7. `log_filename=postgresql-supabase.log` for the fail2ban jail.
8. The DB port binding changed from `127.0.0.1:${POSTGRES_PORT}:${POSTGRES_PORT}` to `${POSTGRES_PORT}:${POSTGRES_PORT}`.
9. The data volume path changed to `/var/lib/encrypted-data/supabase-data`.
10. `playbook-supabase.yml` overwritten to the roles `supabase`, `manifest`, `agent_access` only.

Evidence anchors:

- `leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:120-233` — the clone, the `supabase-custom.yml` heredoc, the `sed` overrides and the `playbook-supabase.yml` overwrite.
- `leadminer.io@256a710:.github/workflows/deploy-supabase-stack-prod.yml:121-232` — the same mutation sequence on the prod host.
- `supabase-selfhost-ops@56638b9:env/supabase.yml:262` — the upstream default `backup_enabled: false`.
- `supabase-selfhost-ops@56638b9:playbook-supabase.yml` — the upstream role list that the overwrite reduces.

## Alternatives considered

- Commit the Leadminer-specific overrides into a fork of `supabase-selfhost-ops`: rejected because it would require tracking every upstream release.
- Configure everything through `config.yml` / `env/supabase.yml` in the upstream repo: partially used, but the upstream templates hardcode several values that Leadminer must change.
- Run the upstream stack unmodified: rejected because the app relies on the `private` PostgREST schema and the custom access-token hook for every authenticated query.

## Consequences

- The deployed Supabase configuration is reproducible only by running the workflow. There is no committed artifact that matches the running stack.
- Every override is an exact-string `sed`/`heredoc` match against a foreign repo's file. If upstream reformats the target line, the override silently no-ops; the workflow has no `set -e`-equivalent protection for a missed substitution.
- The role overwrite drops the upstream `backup`, `caddy`, `monitor`, `fail2ban`, `luks`, `ufw` and `hardening` roles. Physical backups and PITR are therefore not deployed by this workflow, even though the upstream repo supports them.
- Upgrading `supabase-selfhost-ops` requires re-checking every mutation against the new templates before a deploy.

## Related docs

- [../runbooks/supabase-operations.md](../runbooks/supabase-operations.md)
- [../runbooks/deploy.md](../runbooks/deploy.md)
