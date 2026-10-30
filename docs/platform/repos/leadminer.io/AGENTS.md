> **Proposal, not live doc.** Copy this file to `leadminer.io/AGENTS.md`. It is not read by agents where it sits now, and it is not the platform's source of truth for this repo — see [../../repo-map.md](../../repo-map.md).
> Verified against `leadminer.io@256a710` (2026-10-30). Re-verify before copying.

# Agent instructions for `leadminer.io`

This repository owns the deploy automation, secrets, and runtime templates for the Leadminer platform. Read `README.md` for the ownership map. This file gives the rules an agent needs before it changes a workflow, a compose template, or a deploy script.

## What this repository owns

- The 24 workflows in `.github/workflows/`. They deploy QA and prod, the Supabase stack, edge functions, vault secrets, monitoring, Redis, and TheDig.
- The runtime compose files `docker-compose.yml` and `docker-compose.qa.yml`.
- The envsubst template `.env`.
- `ansible/`, `terraform/digitalocean/`, `monitoring-master/`, `monitoring-agent/`, `redis/`, `thedig.env`, `thedig-whitelist`, `zap/`, `supabase/functions/`, `supabase/migrations/`, `supabase/email-templates/`, and `data-backup/`.

## Deploy chain

A change in the application repository triggers a workflow in this repository through `repository_dispatch`. The app repository does not deploy itself.

- QA backend: `qa-trigger-backend-build.yml` in the app repository → `trigger-qa-backend-build` → `qa-backend-build-deploy-prodhost.yml` in this repository.
- QA frontend: `qa-trigger-frontend-build.yml` in the app repository → `trigger-qa-frontend-build` → `qa-frontend-build-deploy-prodhost.yml`.
- QA no-build: `qa-trigger-no-build.yml` in the app repository → `trigger-qa-no-build` → `qa-no-build-deploy-prodhost.yml`.
- Prod: release published in the app repository → `prod-trigger.yml` → `trigger-prod` → `deploy-prod-prodhost.yml`.

## Rules

### Do not edit the deployed compose file on the droplet

The app checkout's `docker-compose.yml` is generated from the ops template and restored by `git restore docker-compose.yml` during the deploy (`deploy-prod-prodhost.yml:163`). A hand-edit disappears on the next deploy. Change the template in this repository instead.

### Do not delete rows from `supabase_migrations.schema_migrations`

The prod migration history repair is guarded by two conditions in `supabase-migrations-prod.yml:96-99`: `name LIKE '%placeholder%'` and a `NOT EXISTS` table check. Do not run an unguarded `DELETE` against this table.

### Do not run `supabase db push` without `--include-all`

Out-of-order migration versions are expected because two repositories write into one migration table. The prod workflow uses `--include-all` (`supabase-migrations-prod.yml:106-108`).

### Do not read the git-tracked env files

`supabase/functions/.env.dev` and `supabase/functions/.env.prod` are tracked in git and contain credential-shaped values. Do not use them as a source for documentation or configuration. Derive variable names from the workflows' `envs:` lists and `vars.*`/`secrets.*` references.

### Treat the `workflow_run` reference as non-functional

The three QA app-deploy workflows declare `workflow_run: workflows: ["Deploy Supabase"]` (`qa-backend-build-deploy-prodhost.yml:5-6`; `qa-frontend-build-deploy-prodhost.yml:5-6`; `qa-no-build-deploy-prodhost.yml:5-6`). No workflow in this repository has that name. The real triggers are `repository_dispatch`, `workflow_dispatch`, and for `qa-no-build-deploy-prodhost.yml` a `push` to `thedig-whitelist` (`qa-no-build-deploy-prodhost.yml:9-11`).

## Gotchas

- **QA co-location:** QA and prod app deployments share the prod host at `vars.LEADMINER_PROD_IP` (`qa-backend-build-deploy-prodhost.yml:105`; `deploy-prod-prodhost.yml:139`). QA uses ports 8121, 8182, and 8183 (`qa-backend-build-deploy-prodhost.yml:190-192`). QA Supabase is a separate host (`vars.SSH_HOST_SUPABASE_QA`).
- **Frontend image tags:** prod uses `ankabootorg/leadminer-frontend:latest` (`docker-compose.yml:48`); QA uses `ankabootorg/leadminer-frontend-qa:latest` (`docker-compose.qa.yml:48`).
- **Append-only Supabase tree:** functions are synced with `rsync` without `--delete` (`leadminer/.github/workflows/push-supabase-functions.yml:22`) and copied with `cp -r` on the server (`deploy-supabase-functions-qa.yml:67`; `deploy-supabase-functions-prod.yml:60`). A function deleted upstream is still deployed.
- **The deployed Supabase config is not in this repository.** It is applied by `sed` and heredoc mutations in `deploy-supabase-stack-qa.yml:120-233` at deploy time.

## Commands

```bash
# List the workflows
ls .github/workflows

# Check the compose templates
sed -n '1,80p' docker-compose.yml
sed -n '1,80p' docker-compose.qa.yml

# Inspect the Supabase stack override
sed -n '120,233p' .github/workflows/deploy-supabase-stack-qa.yml

# Inspect the data-backup restore procedure
sed -n '88,132p' data-backup/README.md
```

## Known gaps

- The deployed Supabase configuration exists only on the server at deploy time and is not committed.
- Whether `vars.LEADMINER_QA_IP` is in active use for the app stack is not documented.
- The origin of the 13 orphan files in `supabase/functions` cannot be recovered from the shallow clone.

## Related docs

- [./README.md](./README.md)
- [../../repo-map.md](../../repo-map.md)
- [../../deployment-flow.md](../../deployment-flow.md)
- [../../maintenance/doc-health-audit.md](../../maintenance/doc-health-audit.md)
