# Deploy

> Use this runbook to deploy the Leadminer application stack, the Supabase stack, Supabase edge functions or database migrations to QA or prod.

## When to use this

- A change to `leadminer/main` should reach QA.
- A release is published and should reach prod.
- You need to deploy the Supabase stack, edge functions or migrations without an application change.
- You need to verify that a deploy succeeded.

## Preconditions

- Access to `ankaboot-source/leadminer` and `ankaboot-source/leadminer.io` with permission to run workflows.
- For prod: membership in the `baderdean` or `zieddhf` approval group.
- For Supabase deploys: the `SSH_HOST_SUPABASE_QA` / `SSH_HOST_SUPABASE_PROD` variables and the corresponding `SSH_PRIVATE_SUPABASE_*` / `SSH_USERNAME_SUPABASE_*` secrets are set in `leadminer.io`.
- For migrations: `SUPABASE_DB_URL_QA` / `SUPABASE_DB_URL_PROD` and `DO_TOKEN`.

## Procedure

### 1. Application stack (QA)

QA runs on the prod droplet with QA ports and `docker-compose.qa.yml`. [verified leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:105,115,136,190-196]

1. Push to `leadminer/main` touching `backend/**` or `micro-services/**`; this dispatches `trigger-qa-backend-build`. [verified leadminer@469c7f8b:.github/workflows/qa-trigger-backend-build.yml:5-10]
2. A push touching `frontend/**` dispatches `trigger-qa-frontend-build`. [verified leadminer@469c7f8b:.github/workflows/qa-trigger-frontend-build.yml:5-9]
3. Any other path (excluding the workflow paths and `supabase/**`) dispatches `trigger-qa-no-build`. [verified leadminer@469c7f8b:.github/workflows/qa-trigger-no-build.yml:5-13]
4. Wait for the frontend build if it is running: the backend workflow polls `qa-frontend-build-deploy-prodhost.yml` and waits while a run is in progress. [verified leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:15-49]
5. The deploy job on the prod host pulls `leadminer.io`, resets `leadminer_qa`, runs the Caddy playbook, exports the environment, converts the compose template and starts the stack. [verified leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:113-203]
6. If the backend was rebuilt, the job runs `docker compose build --no-cache` for the five backend services before `up -d`. [verified leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:198-203]
7. If this was a frontend-only change, the frontend workflow removes the old QA image tag and runs `docker compose --env-file .env up -d`. [verified leadminer.io@256a710:.github/workflows/qa-frontend-build-deploy-prodhost.yml:232-235]

The `workflow_run: ["Deploy Supabase"]` declaration on the three QA workflows does not resolve: no workflow in `leadminer.io` carries that name. The workflows are triggered by their dispatch events and manual `workflow_dispatch`, not by a Supabase deploy. [verified leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:5-8]

### 2. Application stack (prod)

1. Publish a release in `leadminer`, or run `deploy-prod-prodhost.yml` with `workflow_dispatch`. [verified leadminer@469c7f8b:.github/workflows/prod-trigger.yml:5-6] [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:3-5]
2. Approve the `Deploy to Prod` issue (`baderdean` or `zieddhf`, at least one approval). [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:10-16]
3. The build job clones `leadminer`, runs `leadminer-integration.sh`, builds the frontend with prod build args and pushes `ankabootorg/leadminer-frontend:latest`. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:28-79]
4. The deploy job pulls `leadminer.io`, resets `leadminer_prod`, runs the Caddy playbook, exports the environment and renders `.env` and `docker-compose.yml`. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:148-238]
5. It removes old `lead*` images and runs `docker compose --env-file .env up -d --build --force-recreate`. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:244-249]
6. It prunes unused images. [verified leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:251-252]

### 3. Supabase stack (QA and prod)

The stack is rendered from `supabase-selfhost-ops` on the target server and then mutated in place. See [./supabase-operations.md](./supabase-operations.md) for the override list.

1. Run `deploy-supabase-stack-qa.yml` (manual or `trigger-supabase-deploy`) or `deploy-supabase-stack-prod.yml` (manual). [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:2-5] [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-prod.yml:2-3]
2. The job waits for the matching migration workflow to finish before it starts. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:13-35]
3. It clones or resets `supabase-selfhost-ops`, generates secrets and renders `env/supabase.yml`. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:87-172]
4. It applies the in-place overrides (`PGRST_*`, mailer URLs, Postgres tuning, log filename, port binding, data path) and overwrites `playbook-supabase.yml`. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:174-234]
5. It runs `./install.sh` on the host. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:236-237]
6. It renders and applies the Supabase Caddy config, then enables fail2ban. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:239-248]
7. It dispatches `deploy-supabase-functions-qa.yml` and a post-deploy E2E run. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:250-265]

### 4. Supabase edge functions

1. QA: a push to `supabase/functions/**` in `leadminer.io`, or a manual `deploy-supabase-functions-qa.yml` run, copies the function tree into the server volume and restarts the functions service. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-qa.yml:3-7] [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-qa.yml:64-67]
2. Prod: a `trigger-prod` dispatch or a manual `deploy-supabase-functions-prod.yml` run does the same on the prod Supabase host. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-prod.yml:3-5] [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-prod.yml:57-60]
3. The job injects the edge-function environment variables into the server `.env` and compose files, then runs `docker compose -f docker-compose-supabase.yml up -d functions`. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-functions-prod.yml:62-110]

Source convergence is append-only. A function deleted in the app or commercial repo is still present in the ops repo and is still deployed. See [./supabase-operations.md](./supabase-operations.md).

### 5. Database migrations

QA and prod use different mechanisms.

| Environment | Mechanism                                                                  | History row                           |
| ----------- | -------------------------------------------------------------------------- | ------------------------------------- |
| QA          | `psql -f` loop over sorted files, skipping versions already present        | Manual `INSERT ... statements = '{}'` |
| Prod        | `supabase db push --include-all --debug` after two guarded history repairs | CLI-managed                           |

[verified leadminer.io@256a710:.github/workflows/supabase-migrations-qa.yml:127-143] [verified leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:88-108]

1. QA migrations run on a push to `supabase/migrations/**`. [verified leadminer.io@256a710:.github/workflows/supabase-migrations-qa.yml:3-7]
2. Prod migrations run on `trigger-prod` or manual dispatch. [verified leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:3-5]
3. Both workflows temporarily allow the runner IP through the `supabase-firewall` and close it in an `always()` step. [verified leadminer.io@256a710:.github/workflows/supabase-migrations-qa.yml:115-149]
4. After a migration that adds or changes a function, reload the PostgREST schema cache by running `NOTIFY pgrst, 'reload schema';` against the database, or restart the `rest` service. [verified supabase-selfhost-ops@56638b9:AGENTS.md:146]

### 6. Appendix: convergence, backups and known gaps

**Append-only convergence.** The ops `supabase/functions` tree holds 202 files; the app-plus-commercial union holds 189. Thirteen files exist only in ops. The migrations are an exact union: 121 = 115 app + 6 commercial. No sync path uses `--delete`. [verified leadminer.io@256a710:supabase/functions] [verified leadminer@469c7f8b:supabase/functions] [verified leadminer-commercial@1840116:supabase/functions] [verified leadminer@469c7f8b:.github/workflows/push-supabase-functions.yml:22] [verified leadminer@469c7f8b:.github/workflows/push-supabase-migrations.yml:26]

**Known gap: `billing/shared/**`.** Three files (`billing/shared/{billing-manager,mod,types}.ts`) exist in the ops repo and in neither source repo. Their origin is not recoverable from the shallow clone.

**Known gap: `add-mining-source`.** The ops repo contains one copy; `saas-supabase/` contains a divergent second copy. The app repo has none. Which copy is deployed is unrecovered.

**PITR is not enabled for Leadminer.** The upstream `supabase-selfhost-ops` repo ships `backup.yml`, `restore.yml` and `restore-verify.yml`, but the Leadminer stack workflow overwrites `playbook-supabase.yml` to the roles `supabase`, `manifest` and `agent_access`, dropping `backup`. The shipped `env/supabase.yml` sets `backup_enabled: false`. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:225-233] [verified supabase-selfhost-ops@56638b9:env/supabase.yml:262]

## Verification

- Application: the post-deploy E2E workflow runs the Deno suite against the target environment. [verified leadminer.io@256a710:.github/workflows/test-leadminer-post-deploy.yml:1-20]
- Supabase: the stack workflow dispatches `test-leadminer-post-deploy.yml` with `env=qa` or `env=prod`. [verified leadminer.io@256a710:.github/workflows/deploy-supabase-stack-prod.yml:253-260]
- Migrations: check the workflow log for `SKIP`/`APPLY`/`OK` lines on QA, or `Finished supabase db push.` on prod. [verified leadminer.io@256a710:.github/workflows/supabase-migrations-qa.yml:135-143] [verified leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:108]
- Application HTTP status: Grafana Unified Alerting probes frontend and backend status for prod and QA. [verified leadminer.io@256a710:docs/MONITORING.md:52-59]

## Rollback

See [./rollback.md](./rollback.md). The application stack rolls back by reverting the commit and redeploying. The database rolls back only through the logical dump. Edge functions have no rollback.

## Troubleshooting

| Symptom                                             | Cause                                                         | Action                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| QA returns 404 for a new API route                  | Backend image was not rebuilt                                 | Trigger `qa-backend-build-deploy-prodhost.yml` or push a backend change   |
| Prod deploy does not start                          | Release not published, or approval not given                  | Publish a release or run the workflow manually; approve the issue         |
| Supabase deploy silently leaves a setting unchanged | An exact-string `sed` no longer matches the upstream template | Inspect the rendered files on the server and update the workflow override |
| Edge function returns 500 after a sync              | The function imports a helper that did not land with it       | Re-sync functions; see [./troubleshooting.md](./troubleshooting.md)       |
| Migration push refuses a version                    | `--include-all` missing                                       | Use the prod workflow, never a bare `supabase db push`                    |

## Related docs

- [./rollback.md](./rollback.md)
- [./supabase-operations.md](./supabase-operations.md)
- [./incident-response.md](./incident-response.md)
