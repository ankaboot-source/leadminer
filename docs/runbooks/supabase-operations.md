<!-- verified: 2026-10-30 leadminer@469c7f8b leadminer.io@256a710 leadminer-commercial@1840116 supabase-selfhost-ops@56638b9 -->

# Supabase operations

> Use this runbook to operate the self-hosted Supabase stack: apply migrations, deploy or retire edge functions, reload PostgREST, and understand why the deployed configuration is not in any repository.

## When to use this

- You need to deploy or retire an edge function.
- You need to run or verify database migrations.
- PostgREST cannot find a function or table it should see.
- You need to understand why a setting differs from the `supabase-selfhost-ops` default.

## Preconditions

- SSH access to the QA or prod Supabase host (`vars.SSH_HOST_SUPABASE_QA` / `vars.SSH_HOST_SUPABASE_PROD`).
- The `supabase-db-<env>` container is running (the `deploy_env` suffix is `qa` or `prod`). [verified supabase-selfhost-ops@56638b9:AGENTS.md:88]
- For migrations: `SUPABASE_DB_URL_QA` / `SUPABASE_DB_URL_PROD` and `DO_TOKEN`.
- For edge functions: access to `leadminer.io` workflows.

## The deployed config is not in any repo

The Supabase stack is cloned from `supabase-selfhost-ops` on the target host and then mutated in place by the deploy workflow. The mutations are never committed back to any repository. The running configuration exists only on the server and in the workflow script. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:120-233]

The full override list applied at deploy time. **This runbook is the sole owner of that list**; other docs link here rather than restating the override ranges.

| #   | Override                                                                            | Evidence                               |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | `PGRST_DB_SCHEMAS=private,storage,graphql_public`                                   | `deploy-supabase-stack-qa.yml:175`     |
| 2   | `PGRST_DB_MAX_ROWS=100000`                                                          | `deploy-supabase-stack-qa.yml:176`     |
| 3   | `PGRST_DB_EXTRA_SEARCH_PATH=private`                                                | `deploy-supabase-stack-qa.yml:177`     |
| 4   | `pg-functions://postgres/private/custom_access_token_hook`                          | `deploy-supabase-stack-qa.yml:178`     |
| 5   | Five `MAILER_TEMPLATES_*` URL rewrites to the storage `templates` bucket            | `deploy-supabase-stack-qa.yml:180-186` |
| 6   | Sixteen Postgres tuning flags (`max_connections` through `max_wal_size`)            | `deploy-supabase-stack-qa.yml:188-216` |
| 7   | `log_filename=postgresql-supabase.log` for fail2ban                                 | `deploy-supabase-stack-qa.yml:218-219` |
| 8   | DB port bound to all interfaces instead of loopback                                 | `deploy-supabase-stack-qa.yml:221-222` |
| 9   | Data volume path set to `/var/lib/encrypted-data/supabase-data`                     | `deploy-supabase-stack-qa.yml:224-225` |
| 10  | `playbook-supabase.yml` overwritten to roles `supabase`, `manifest`, `agent_access` | `deploy-supabase-stack-qa.yml:227-234` |

All citations above are `leadminer.io@256a710`. The prod stack workflow applies the same sequence: `deploy-supabase-stack-prod.yml:121-232`.

Consequences of this model:

- Each override is an exact-string `sed`/heredoc match against a foreign repo's template. If upstream reformats the target line, the override silently no-ops.
- The role overwrite drops the upstream `backup`, `caddy`, `monitor`, `fail2ban`, `luks`, `ufw` and `hardening` roles. Backups and PITR are not installed by this workflow. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:225-233]
- The `private` PostgREST schema is the reason every migration and function uses `SET search_path = ''`. It is configured only inside the workflow, not in any checked-in config file.

### PITR status

PITR is available in `supabase-selfhost-ops` but is not deployed for Leadminer.

- The upstream repo ships `backup.yml` (on-demand full backup), `restore.yml` (guardrailed PITR restore) and `restore-verify.yml` (non-destructive restore verification). [verified supabase-selfhost-ops@56638b9:backup.yml:1-36] [verified supabase-selfhost-ops@56638b9:restore.yml:1-155] [verified supabase-selfhost-ops@56638b9:restore-verify.yml:1-165]
- The upstream `env/supabase.yml` ships `backup_enabled: false`. [verified supabase-selfhost-ops@56638b9:env/supabase.yml:262]
- The Leadminer stack workflow overwrites `playbook-supabase.yml` to `supabase`, `manifest`, `agent_access`, dropping the `backup` role entirely. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:225-233]

Do not assume a PITR restore is possible on QA or prod. The only documented restore path is the logical `s3-backup.sh` dump described in [./rollback.md](./rollback.md). The backlog item to enable the backup role is tracked in [../platform/maintenance/backlog.md](../platform/maintenance/backlog.md).

## Append-only convergence model

Supabase functions and migrations converge in `leadminer.io/supabase/{functions,migrations}`. The conversion is append-only:

- Functions: 202 files in the ops tree; 189 in the app-plus-commercial union; 13 files exist only in ops; 0 exist upstream but not in ops. Counts re-derived at `leadminer@469c7f8b`, `leadminer-commercial@1840116`, `leadminer.io@256a710`.
- Migrations: exact union, 121 = 115 app + 6 commercial. [verified leadminer@469c7f8b:supabase/migrations] [verified leadminer-commercial@1840116:supabase/migrations] [verified leadminer.io@256a710:supabase/migrations]
- The app-repo sync excludes `billing/`, `email-campaigns/middlewares-mod.ts` and `mail/passive-mining-failed/template.ts`. [verified leadminer@469c7f8b:.github/workflows/push-supabase-functions.yml:22]
- No sync path uses `--delete`. [verified leadminer@469c7f8b:.github/workflows/push-supabase-migrations.yml:26]
- The server deploy copies with `cp -r .../functions/*`, which does not delete. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-qa.yml:64-67]

Consequence: deleting a function in `leadminer` or `leadminer-commercial` does not undeploy it. The function remains in the ops repo and in the server volume until it is removed there explicitly.

## Procedure: run and verify migrations

See [./deploy.md](./deploy.md#5-database-migrations) for the full environment-by-environment procedure. The summary:

| Environment | Mechanism                                                                              | History     |
| ----------- | -------------------------------------------------------------------------------------- | ----------- |
| QA          | `psql -f` loop over sorted files; skip if `version` exists; insert `statements = '{}'` | Manual      |
| Prod        | `supabase db push --include-all --debug` after two guarded repairs                     | CLI-managed |

[verified leadminer.io@256a710:.github/workflows/supabase-migrations-qa.yml:127-143] [verified leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:88-108]

## Procedure: reload the PostgREST schema cache

After a migration that adds or changes a function or table, PostgREST may not see it. Reload the schema cache:

1. Connect to the database directly on port `5432`. Do not use the pooler on `6543`. [verified supabase-selfhost-ops@56638b9:AGENTS.md:89-92]
2. Run `NOTIFY pgrst, 'reload schema';`. [unverified — confirm before first use: derived from session history, not from a committed procedure]
3. Alternatively, restart the `rest` service: `docker compose restart rest`. [verified supabase-selfhost-ops@56638b9:AGENTS.md:146]
4. Verify by calling the RPC or table through the API again. A remaining `Could not find the function ... in the schema cache` error means the migration did not land, not that the reload failed. [unverified — confirm before first use: derived from session history]

## Procedure: deploy an edge function

1. Make the change in `leadminer` (or `leadminer-commercial` for the excluded paths). [verified leadminer@469c7f8b:.github/workflows/push-supabase-functions.yml:22]
2. Push to `main`. The sync workflow rsyncs the tree into `leadminer.io` without deleting. [verified leadminer@469c7f8b:.github/workflows/push-supabase-functions.yml:22-31]
3. QA deploys on a push to `supabase/functions/**`; prod deploys on `trigger-prod` or manual dispatch. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-qa.yml:3-7] [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-prod.yml:3-5]
4. The deploy job copies the tree into the server volume and restarts the functions service. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-qa.yml:64-67] [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-qa.yml:115-117]
5. Verify with the function's endpoint through the API gateway. [verified supabase-selfhost-ops@56638b9:AGENTS.md:122]

## Procedure: how to actually retire an edge function

**Status: [unverified — confirm]**. This procedure is derived from the deploy mechanics, not from an observed retirement. Confirm each step on QA before using it on prod.

Because deploys are additive, retiring a function requires deleting it from both the source-of-truth tree and the server volume.

1. [unverified — confirm] Delete the function directory from `leadminer.io/supabase/functions/<name>/`.
2. [unverified — confirm] Confirm the function is absent from the ops tree: `ls leadminer.io/supabase/functions/<name>` returns no such directory.
3. [unverified — confirm] On the target Supabase host, remove the deployed directory from the functions volume: `rm -rf "$HOME/supabase/docker/volumes/functions/<name>"`.
4. [unverified — confirm] Restart the functions service so the runtime stops serving the removed directory: `docker compose -f docker-compose-supabase.yml up -d functions`. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-qa.yml:115-117]
5. [unverified — confirm] Verify the function path returns 404 through the gateway.
6. [unverified — confirm] Check whether any database trigger or cron still invokes the function. If so, remove or update the invoker before step 3.

Do not rely on deleting the function in `leadminer`: the app-repo sync never deletes, and the ops tree is the deploy source. [verified leadminer@469c7f8b:.github/workflows/push-supabase-functions.yml:22]

## Known gaps

- **`billing/shared/**`**: `billing/shared/billing-manager.ts`, `billing/shared/mod.ts` and `billing/shared/types.ts` exist in the ops repo and in neither source repo. They are imported by nothing in the ops billing tree. Their origin is unrecoverable from the shallow clone. [verified leadminer.io@256a710:supabase/functions/billing/shared]
- **`add-mining-source`**: the ops repo contains one copy (`supabase/functions/add-mining-source/`), and `saas-supabase/` contains a divergent second copy. The app repo has none. Which copy serves the live signup flow is unrecovered. [verified leadminer.io@256a710:saas-supabase/supabase/functions/add-mining-source/index.ts]
- **`email-campaigns/deno.lock`**, **`email-campaigns/tests/*`** and **`sms-campaigns/providers/*`**: these ops-only files are also present in neither source repo.
- **`.env.prod` in the ops functions tree**: a git-tracked file with credential-shaped values. It is not read, reproduced or used as a source anywhere in this doc set. It is recorded here only so a maintainer who finds it knows it is not a deploy input: the server deploy copies `supabase/functions/*`, which does not match dotfiles. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-qa.yml:64-67]

## Verification

- After a function deploy, call the function through the gateway and confirm a non-500 response. [verified supabase-selfhost-ops@56638b9:AGENTS.md:122]
- After a migration, check the history table for the expected version. QA rows carry `statements = '{}'`; prod rows are CLI-managed. [verified leadminer.io@256a710:.github/workflows/supabase-migrations-qa.yml:127-143]
- After a PostgREST reload, the failing RPC should resolve.

## Rollback

There is no function rollback. Fix forward. See [./rollback.md](./rollback.md#4-supabase-edge-functions).

For the database, the only documented restore path is the logical dump. PITR is not deployed. See [./rollback.md](./rollback.md#3-database).

## Troubleshooting

| Symptom                                               | Cause                                                             | Action                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Could not find the function ... in the schema cache` | Migration missing, or PostgREST cache stale                       | Apply the migration, then `NOTIFY pgrst, 'reload schema';`                                                 |
| Edge function 500 after a sync                        | Function imports `_shared/env-helpers.ts` but the helper is stale | Re-sync the functions so both land together; see [./troubleshooting.md](./troubleshooting.md)              |
| Supabase setting differs from the repo default        | The workflow override applied, or silently no-opped               | Inspect the rendered file on the server; check the workflow override against the current upstream template |
| Migration fails on QA but not prod                    | The two environments use different mechanisms                     | Run the same file through the QA `psql` path and check the history row                                     |
| Auth fails after a restore                            | The sequence behind `auth.refresh_tokens` is stale                | Re-sync sequences; see [./rollback.md](./rollback.md#3-database)                                           |

## Related docs

- [./deploy.md](./deploy.md)
- [./rollback.md](./rollback.md)
- [./secrets-and-env.md](./secrets-and-env.md)
- [../platform/three-repo-model.md](../platform/three-repo-model.md)
