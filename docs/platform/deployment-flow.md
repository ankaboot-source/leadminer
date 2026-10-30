# Deployment flow

> Read this if you are trying to understand which workflow fires when a change lands, how QA and production differ, or where the Supabase deployment path splits.

**The ops workflow set and the QA topology differ from what older notes describe. Re-verify every workflow name in this doc against `leadminer.io/.github/workflows/` before acting on it.**

## TL;DR

1. `leadminer` workflows `curl` `/repos/ankaboot-source/leadminer.io/dispatches`; the ops repo runs the deploy (`leadminer@469c7f8b:.github/workflows/qa-trigger-no-build.yml:19-31`).
2. QA deploys on path-filtered pushes to `main` and on `repository_dispatch` (`trigger-qa-*`), with no approval gate.
3. Production deploys on release or manual dispatch, gated by a manual-approval issue (`leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:7-16`).
4. Supabase splits into stack, functions, migrations, vault, templates and E2E paths; QA vault and QA migrations poll each other and can stall.
5. Docs-only pushes to `main` still fire a QA no-build deploy because the no-build trigger does not exclude `docs/**` (`leadminer@469c7f8b:.github/workflows/qa-trigger-no-build.yml:3-14`).

## The dispatch mechanism

The deploy-trigger workflows in `.github/workflows/` are thin dispatchers. `qa-trigger-no-build.yml` shows the whole pattern (`leadminer@469c7f8b:.github/workflows/qa-trigger-no-build.yml:19-31`): one `curl -X POST` to `https://api.github.com/repos/ankaboot-source/leadminer.io/dispatches` with `"event_type": "trigger-qa-no-build"`. The others are identical apart from the event string. The two Supabase sync workflows are the exception: they clone `leadminer.io`, copy the artifacts in, and push (`leadminer@469c7f8b:.github/workflows/push-supabase-functions.yml:16-31`, `leadminer@469c7f8b:.github/workflows/push-supabase-migrations.yml:16-35`).

| Event type                  | Dispatching workflow                                                       | Consuming ops workflow                                                                                                                                                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trigger-qa-backend-build`  | `leadminer@469c7f8b:.github/workflows/qa-trigger-backend-build.yml:17-29`  | `leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:3-4`                                                                                                                                                                                                                             |
| `trigger-qa-frontend-build` | `leadminer@469c7f8b:.github/workflows/qa-trigger-frontend-build.yml:16-28` | `leadminer.io@256a710:.github/workflows/qa-frontend-build-deploy-prodhost.yml:3-4`                                                                                                                                                                                                                            |
| `trigger-qa-no-build`       | `leadminer@469c7f8b:.github/workflows/qa-trigger-no-build.yml:19-31`       | `leadminer.io@256a710:.github/workflows/qa-no-build-deploy-prodhost.yml:3-4`                                                                                                                                                                                                                                  |
| `trigger-prod`              | `leadminer@469c7f8b:.github/workflows/prod-trigger.yml:13-25`              | `leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:3-4`, `leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:3-4`, `leadminer.io@256a710:.github/workflows/deploy-supabase-functions-prod.yml:3-4`, `leadminer.io@256a710:.github/workflows/deploy-vault-secrets-prod.yml:3-4` |
| `trigger-supabase-deploy`   | — none in either repo —                                                    | `leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:3-5`                                                                                                                                                                                                                                     |

No workflow in either repo sends `trigger-supabase-deploy`; the QA stack deploy therefore runs on manual `workflow_dispatch` or on an external dispatch. The three QA app-deploy workflows also declare `workflow_run: workflows: ["Deploy Supabase"]`, but no workflow carries that name (`deploy-supabase-stack-qa.yml` is "Deploy QA Supabase", `deploy-supabase-stack-prod.yml` is "Deploy PROD Supabase"); treat that `workflow_run` as inert.

## QA path

QA deploys run automatically; there is no approval gate.

**Trigger.** Path-filtered pushes to `main` or `repository_dispatch` type `trigger-qa-*`. `qa-no-build-deploy-prodhost.yml` additionally triggers on a push that touches `thedig-whitelist` (`leadminer.io@256a710:.github/workflows/qa-no-build-deploy-prodhost.yml:9-12`).

**Pipeline.**

1. `qa-trigger-backend-build.yml`, `qa-trigger-frontend-build.yml`, or `qa-trigger-no-build.yml` fires and sends its `repository_dispatch`.
2. `qa-backend-build-deploy-prodhost.yml` / `qa-frontend-build-deploy-prodhost.yml` / `qa-no-build-deploy-prodhost.yml` runs on the prod host. Every QA workflow targets `/home/leadminer/leadminer_qa` (`leadminer.io@256a710:.github/workflows/qa-no-build-deploy-prodhost.yml:82-83`, `leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:114-115`, `leadminer.io@256a710:.github/workflows/qa-frontend-build-deploy-prodhost.yml:141-142`), so the QA app stack lives on the production droplet.
3. The backend workflow first polls the QA frontend workflow until it finishes (`leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:15-36`).
4. Each job clones/pulls both repos, runs `leadminer-integration.sh` (`leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:199-200`, `leadminer.io@256a710:.github/workflows/qa-frontend-build-deploy-prodhost.yml:229-230`), templates `.env` and `docker-compose.yml` from the ops repo with `envsubst`, then runs `docker compose up -d`.
5. QA services use the ports `8121` (API), `8182` (frontend) and `8183` (email fetcher) (`leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:190-192`, `leadminer.io@256a710:.github/workflows/qa-frontend-build-deploy-prodhost.yml:217-219`, `leadminer.io@256a710:.github/workflows/qa-no-build-deploy-prodhost.yml:158-160`).

## Production path

Production deploys require manual approval.

**Trigger.** A published GitHub Release (`leadminer@469c7f8b:.github/workflows/prod-trigger.yml:3-12`) or a manual `workflow_dispatch` (`leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:3-5`).

**Approval mechanism.** The workflow's first job, `approval`, uses `trstringer/manual-approval@v1` (`leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:7-16`). It opens a GitHub issue titled `Deploy to Prod` (`leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:15`) and accepts the comments `LGTM! or approved` or `deny or Denied!` (`leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:16`). The approvers are `baderdean, zieddhf` with a minimum of one approval (`leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:13-14`).

**Pipeline.**

1. `prod-trigger.yml` sends `trigger-prod`.
2. `deploy-prod-prodhost.yml`'s `build` job builds and pushes the frontend image only (`leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:18-79`); the backend is built on the server.
3. The `deploy` job runs on the prod host, targets `/home/leadminer/leadminer_prod` (`leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:149-150,161-167`), clones/pulls both repos, runs `leadminer-integration.sh` (`leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:169-175,240-242`), templates the config, and runs `docker compose up -d --build` (`leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:247-249`).
4. Production uses the ports `8021` (API) and `8083` (email fetcher) (`leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:233-234`); the frontend is fixed at `8082` in the prod compose file (`leadminer.io@256a710:docker-compose.yml:51`).

## Supabase path

The Supabase deployment is five separate paths that do not share a trigger.

- **Stack.** `deploy-supabase-stack-qa.yml` runs on `workflow_dispatch` and `repository_dispatch` type `trigger-supabase-deploy` (`leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:3-5`); `deploy-supabase-stack-prod.yml` runs on `workflow_dispatch` only (`leadminer.io@256a710:.github/workflows/deploy-supabase-stack-prod.yml:3`). Both clone `ankaboot-source/supabase-selfhost-ops` and reset it to `origin/main`, mutate its templates in place, and run `install.sh` (`leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:128-237`). On completion they trigger the matching functions deploy and the E2E suite with `gh workflow run` (`leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:250-264`, `leadminer.io@256a710:.github/workflows/deploy-supabase-stack-prod.yml:248-260`).
- **Functions.** `deploy-supabase-functions-qa.yml` runs on a push to `supabase/functions/**` and `workflow_dispatch` (`leadminer.io@256a710:.github/workflows/deploy-supabase-functions-qa.yml:3-7`); `deploy-supabase-functions-prod.yml` runs on `repository_dispatch` type `trigger-prod` and `workflow_dispatch` (`leadminer.io@256a710:.github/workflows/deploy-supabase-functions-prod.yml:3-5`). Both copy the convergence tree with `cp -r .../functions/*` and never delete (`leadminer.io@256a710:.github/workflows/deploy-supabase-functions-qa.yml:64-67`, `leadminer.io@256a710:.github/workflows/deploy-supabase-functions-prod.yml:57-60`).
- **Migrations.** `supabase-migrations-qa.yml` runs on a push to `supabase/migrations/**` and `workflow_dispatch` (`leadminer.io@256a710:.github/workflows/supabase-migrations-qa.yml:3-7`) with a `psql -f` loop (`leadminer.io@256a710:.github/workflows/supabase-migrations-qa.yml:127-144`). `supabase-migrations-prod.yml` runs on `repository_dispatch` type `trigger-prod` and `workflow_dispatch` (`leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:3-5`) with `supabase db push --include-all --debug` (`leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:103-108`).
- **Vault.** `deploy-vault-secrets-qa.yml` runs on a push to `supabase/migrations/**` and `workflow_dispatch` (`leadminer.io@256a710:.github/workflows/deploy-vault-secrets-qa.yml:3-7`); `deploy-vault-secrets-prod.yml` runs on `repository_dispatch` type `trigger-prod` and `workflow_dispatch` (`leadminer.io@256a710:.github/workflows/deploy-vault-secrets-prod.yml:3-5`). QA vault and QA migrations poll each other's in-progress runs (`leadminer.io@256a710:.github/workflows/deploy-vault-secrets-qa.yml:60-75` vs `leadminer.io@256a710:.github/workflows/supabase-migrations-qa.yml:10-35`), so a simultaneous trigger stalls both.
- **Templates and E2E.** `supabase-storage-upload.yml` runs on a push to `supabase/email-templates/**` and `workflow_dispatch` (`leadminer.io@256a710:.github/workflows/supabase-storage-upload.yml:3-7`). `test-leadminer-post-deploy.yml` runs on `workflow_dispatch` with an `env` input and `repository_dispatch` type `test-leadminer-post-deploy` (`leadminer.io@256a710:.github/workflows/test-leadminer-post-deploy.yml:12-24`).

## QA vs prod migration mechanisms

The two environments do not apply migrations the same way. QA uses a loop and writes its own history; prod uses the Supabase CLI's history table.

|              | QA                                                                          | Production                                                                    |
| ------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Command      | `psql -f` loop over `supabase/migrations/*.sql`                             | `supabase db push --include-all --debug`                                      |
| History rows | Manual `INSERT ... statements = '{}'`                                       | CLI-managed                                                                   |
| Cite         | `leadminer.io@256a710:.github/workflows/supabase-migrations-qa.yml:127-144` | `leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:103-108` |

A migration that works in QA can therefore fail in production if its history entry is wrong.

## The inert workflow_run reference

`workflow_run` on `["Deploy Supabase"]` in `leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:5-8`, `leadminer.io@256a710:.github/workflows/qa-frontend-build-deploy-prodhost.yml:5-8` and `leadminer.io@256a710:.github/workflows/qa-no-build-deploy-prodhost.yml:5-8` matches no workflow in the repo, whose Supabase stack workflows are named `Deploy QA Supabase` and `Deploy PROD Supabase`.

## The paths-ignore gotcha

`qa-trigger-no-build.yml` triggers on `push` to `main` but its `paths-ignore` list does not include `docs/**` (`leadminer@469c7f8b:.github/workflows/qa-trigger-no-build.yml:3-14`). A docs-only push to `main` therefore fires a QA no-build deploy by itself.

## Relationship to leadminer.io/docs/DEPLOY.md

`leadminer.io@256a710:docs/DEPLOY.md` is the ops-side doc. Its workflow links are stale as of `leadminer.io@256a710`: `qa-frontend-build-deploy.yml`, `qa-backend-build-deploy.yml`, `qa-no-build-deploy.yml` and `deploy-prod.yml` do not exist (the current files are the `*-prodhost` workflows and `deploy-prod-prodhost.yml`). This hub does not replace it; it records the workflow set as it exists at the verified SHAs. See [./repo-map.md](./repo-map.md) for the file that maps the ops workflows.

## Known gaps

- No workflow in either repo sends `trigger-supabase-deploy`; the QA stack deploy runs only on manual `workflow_dispatch` or an external dispatch.
- The prod stack workflow has no `repository_dispatch` trigger; it runs only on `workflow_dispatch`.
- QA vault and QA migrations poll each other's in-progress runs, so a simultaneous trigger stalls both; which one is expected to run first is unrecovered.
- Whether the approval gate's `deny or Denied!` branch has any follow-up action beyond rejecting the deployment is unverified.

## Related docs

- [./overview.md](./overview.md)
- [./three-repo-model.md](./three-repo-model.md)
- [./repo-map.md](./repo-map.md)
- [./glossary.md](./glossary.md)
- [../runbooks/deploy.md](../runbooks/deploy.md)
- [../runbooks/rollback.md](../runbooks/rollback.md)
- [../runbooks/supabase-operations.md](../runbooks/supabase-operations.md)

<!-- verified: 2026-10-30 leadminer@469c7f8b leadminer.io@256a710 leadminer-commercial@1840116 supabase-selfhost-ops@56638b9 -->
