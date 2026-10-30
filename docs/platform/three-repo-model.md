# The three-repo model: leadminer, leadminer.io, leadminer-commercial

> **Scope and limits.** This doc covers the three repos you edit. Two more participants exist and are documented elsewhere: `ankaboot-source/supabase-selfhost-ops` (the Supabase distribution that renders the database stack — see [./overview.md](./overview.md)) and the hosted `saas-supabase` project the frontend calls directly. A Leadminer deploy touches five repos, not three. If you are debugging the database, this doc is not enough.

## TL;DR

1. Nothing in `leadminer` deploys itself. `leadminer.io` owns every deploy workflow, every secret, and the runtime compose/env templates. (`leadminer/.github/workflows/*` are dispatchers only — `qa-trigger-no-build.yml:19-31` contains a single `curl` to `/repos/ankaboot-source/leadminer.io/dispatches`.)
2. `leadminer-commercial` is a source overlay copied into the app checkout at deploy time, for `backend/` and `frontend/` only. It never touches `supabase/`. (`leadminer-integration.sh:59-60`.)
3. Supabase artifacts converge in `leadminer.io/supabase/{functions,migrations}`, which is an **append-only accumulation** of OSS + commercial + files deleted upstream. It is not a clean union — see the "Supabase convergence" section. This is the single most surprising fact about the platform.
4. The Supabase _stack_ (Postgres, GoTrue, PostgREST, config) is a separate repo, and the deployed config is not in any repo — see [../runbooks/supabase-operations.md](../runbooks/supabase-operations.md).
5. Prod and QA are not symmetric. The QA app stack is co-located on the prod host; QA Supabase is a different host; the two envs apply migrations by different mechanisms.

## What each repo owns

| Repo                    | Owns                                                                                                                                                                                                                                                | Does not own                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `leadminer`             | Application source (`backend/`, `frontend/`, `micro-services/`), source `supabase/functions` and `supabase/migrations`, dev Dockerfiles, app-level tests.                                                                                           | Deploy workflows, runtime compose/env templates, deployed Supabase config, secrets.               |
| `leadminer.io`          | Deploy workflows, GitHub secrets/vars, `docker-compose.yml` and `docker-compose.qa.yml`, Caddy/Ansible/Terraform templates, the Supabase functions/migrations convergence tree, vault, email-template upload, TheDig, Redis, monitoring, S3 backup. | Application source code, billing source, the Supabase platform itself.                            |
| `leadminer-commercial`  | Billing plugin (`backend/`), billing frontend surface (`frontend/`), billing edge functions (`supabase/functions/billing`), commercial overrides of OSS functions, billing migrations.                                                              | A root app, docker-compose, a backend entry point. It is a source overlay, not a deployable repo. |
| `supabase-selfhost-ops` | The Supabase distribution: Jinja templates, `install.sh`, `setup.sh`, `env/supabase.yml` defaults, Ansible playbooks, backup/restore playbooks, `migrate.sh`.                                                                                       | Leadminer's deployed config (mutated on the server), edge-function source.                        |
| `saas-supabase`         | Hosted Supabase project config (`supabase/config.toml`) and its own functions (`add-mining-source`, `email-templates`, `imap`, `_shared`).                                                                                                          | The self-hosted Supabase stack.                                                                   |

## The overlay mechanism

`leadminer-integration.sh` is invoked during deploy as `leadminer-integration.sh <leadminer_folder> <leadminer_billing_repo_url>` (`leadminer.io@256a710:leadminer-integration.sh:9-11,18-23`). It:

1. Clones the commercial repo into a temporary directory created with `mktemp -d` (`leadminer.io@256a710:leadminer-integration.sh:25`).
2. Aborts the deploy if the clone fails (`leadminer.io@256a710:leadminer-integration.sh:35-38`).
3. Overwrites same-path files by copying `backend/*` over `<app>/backend/` and `frontend/*` over `<app>/frontend/` (`leadminer.io@256a710:leadminer-integration.sh:59-60`). Extra files already present in the app checkout are not deleted.
4. Warns but continues if an overlay directory is missing (`leadminer.io@256a710:leadminer-integration.sh:45-47,54-56`), and aborts only if the target app directory is missing (`leadminer.io@256a710:leadminer-integration.sh:40-43,49-52`). The script has no `set -e`, so a failed `cp` does not stop it.
5. Removes the temporary directory on exit via a `trap` (`leadminer.io@256a710:leadminer-integration.sh:14-16,33`).

It never touches `supabase/`: the script defines only `frontend` and `backend` paths (`leadminer.io@256a710:leadminer-integration.sh:27-31`) and contains no `supabase` reference.

Call sites: prod deploy (`leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:169-175,240-242`), QA backend (`leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:199-200`), QA frontend (`leadminer.io@256a710:.github/workflows/qa-frontend-build-deploy-prodhost.yml:229-230`).

## Supabase convergence

`leadminer.io/supabase/functions` and `leadminer.io/supabase/migrations` are the convergence point for OSS and commercial Supabase artifacts. The functions tree is an append-only accumulation, not a union:

- The ops tree holds **202** files; the app repo holds 154 and the commercial repo 48, for **189** unique files upstream (`leadminer@469c7f8b:supabase/functions/`, `leadminer-commercial@1840116:supabase/functions/`, `leadminer.io@256a710:supabase/functions/`).
- **13** files exist in the ops repo and in neither source repo (paths relative to `leadminer.io@256a710:`): `supabase/functions/add-mining-source/` (2), `supabase/functions/billing/shared/` (3), `supabase/functions/billing/tests/` (2), `supabase/functions/email-campaigns/deno.lock`, two `supabase/functions/email-campaigns/tests/` middleware tests, `supabase/functions/.env.prod` (do not open — see [../runbooks/secrets-and-env.md](../runbooks/secrets-and-env.md)), and `supabase/functions/sms-campaigns/providers/` (2).
- **0** files exist upstream but not in the ops repo.
- Migrations _are_ an exact union: **121** in ops = **115** in the app repo + **6** in the commercial repo, with zero orphans.

No sync path deletes. The OSS sync uses `rsync` without `--delete` (`leadminer@469c7f8b:.github/workflows/push-supabase-functions.yml:22`), the migrations sync does not use `--delete` despite being named "mirror mode" (`leadminer@469c7f8b:.github/workflows/push-supabase-migrations.yml:23-26`), the commercial functions sync uses `cp -r` (`leadminer-commercial@1840116:.github/workflows/push-supabase-functions.yml:20-22`), and the server-side deploy copies with `cp -r .../functions/*` (`leadminer.io@256a710:.github/workflows/deploy-supabase-functions-qa.yml:64-67`, `leadminer.io@256a710:.github/workflows/deploy-supabase-functions-prod.yml:57-60`).

Consequence: **a function deleted upstream is still deployed.** Retiring a function requires deleting it from the ops repo and from the server volume; see [../runbooks/supabase-operations.md](../runbooks/supabase-operations.md).

The conflict contract is the three `rsync` excludes in the OSS functions sync (`leadminer@469c7f8b:.github/workflows/push-supabase-functions.yml:22`): `billing/`, `email-campaigns/middlewares-mod.ts`, `mail/passive-mining-failed/template.ts`. Those are the paths where the commercial copy must win. The commercial workflow copies with no excludes (`leadminer-commercial@1840116:.github/workflows/push-supabase-functions.yml:22`).

## The five participants

A deploy touches five repositories, not three. The three you edit are covered above. The other two are:

- `ankaboot-source/supabase-selfhost-ops` — the Supabase distribution that renders the database stack. See [./overview.md](./overview.md).
- `saas-supabase` — a hosted Supabase project (`leadminer.io@256a710:saas-supabase/supabase/config.toml`) that the frontend calls directly (`leadminer@469c7f8b:frontend/nuxt.config.ts:57-58`, `leadminer@469c7f8b:frontend/src/plugins/api.ts:18,23`). It holds a divergent second copy of `add-mining-source` (`leadminer.io@256a710:saas-supabase/supabase/functions/add-mining-source/index.ts` vs `leadminer.io@256a710:supabase/functions/add-mining-source/index.ts`).

## What is NOT in any repo

The deployed Supabase configuration is not committed anywhere. `deploy-supabase-stack-qa.yml:128-237` clones `supabase-selfhost-ops`, then mutates its templates on the server without committing back. The PostgREST overrides are `PGRST_DB_SCHEMAS=private,storage,graphql_public` (`leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:175`), `PGRST_DB_MAX_ROWS=100000` (`:176`), `PGRST_DB_EXTRA_SEARCH_PATH=private` (`:177`), and the `custom_access_token_hook` path (`:178`). The remaining mailer, Postgres tuning, `log_filename`, port, data-volume and playbook-overwrite overrides are owned by [../runbooks/supabase-operations.md](../runbooks/supabase-operations.md), which carries the complete list; this doc does not restate them. Each override is an exact-string match against a foreign repo's template and silently no-ops if upstream reformats.

## Environment asymmetry

The Leadminer app stack for prod and QA runs on one droplet (`vars.LEADMINER_PROD_IP`), separated by ports and compose files. The QA and prod Supabase instances run on separate droplets (`vars.SSH_HOST_SUPABASE_QA` / `_PROD`). A separate QA host referenced by `vars.LEADMINER_QA_IP` is still used for email-template upload, fail2ban/cron/logrotate, monitoring agents and nightly upgrades.

The two environments also apply migrations by different mechanisms: QA runs a `psql -f` loop and writes its own history rows (`leadminer.io@256a710:.github/workflows/supabase-migrations-qa.yml:127-144`), while prod uses `supabase db push --include-all --debug` (`leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml:103-108`). See the comparison table in [./deployment-flow.md](./deployment-flow.md).

## Known gaps

- The origin and deployed status of the 13 ops-only files are unrecoverable from the shallow clones; in particular `billing/shared/**` is imported by nothing in the ops billing tree.
- Two `add-mining-source` variants exist in `leadminer.io`; which one is deployed is unrecovered.
- Whether anything ever deletes a function from the server volume is unverified; no workflow in the repos does.
- Commercial-only changes have no production trigger in the commercial repo — production receives them only through a release in `leadminer`.

## Related docs

- [./overview.md](./overview.md)
- [./deployment-flow.md](./deployment-flow.md)
- [./repo-map.md](./repo-map.md)
- [./glossary.md](./glossary.md)
- [../runbooks/supabase-operations.md](../runbooks/supabase-operations.md)
- [../runbooks/secrets-and-env.md](../runbooks/secrets-and-env.md)
- [../decisions/](../decisions/)

<!-- verified: 2026-10-30 leadminer@469c7f8b leadminer.io@256a710 leadminer-commercial@1840116 supabase-selfhost-ops@56638b9 -->
