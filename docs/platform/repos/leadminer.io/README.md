> **Proposal, not live doc.** Copy this file to `leadminer.io/README.md`. It is not read by agents where it sits now, and it is not the platform's source of truth for this repo — see [../../repo-map.md](../../repo-map.md).
> Verified against `leadminer.io@256a710` (2026-10-30). Re-verify before copying.

# leadminer.io

> Infrastructure and deployment repository for Leadminer. Read this if you are trying to understand what the ops repository owns, how a deployment is triggered, or which runtime pieces live here.

## TL;DR

- `leadminer.io` owns every deploy workflow, every GitHub secret and variable, and every runtime compose/env template (`leadminer.io/README.md:5-7`).
- It contains 24 GitHub Actions workflows in `.github/workflows/`.
- It owns the runtime compose files, Ansible playbooks, Terraform modules, monitoring stack, Redis configuration, TheDig runtime, ZAP rules, Supabase function and migration artifacts, and the data-backup scripts (`leadminer.io/README.md:9-38`).
- It does not own the application source. The application source is in `ankaboot-source/leadminer`.
- It does not own the Supabase stack distribution. That is `ankaboot-source/supabase-selfhost-ops`.

## What this repository owns

| Area                  | Path                                                                       | What it does                                                                                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy workflows      | `.github/workflows/`                                                       | 24 workflows that deploy QA and prod, the Supabase stack, edge functions, vault secrets, monitoring, Redis, and TheDig.                                                                                                                                             |
| Runtime compose files | `docker-compose.yml`, `docker-compose.qa.yml`                              | Define the app services for prod and QA: `leadminer-api`, the contact-extraction worker, the email-verification worker, the signature worker, the prebuilt frontend image, and the email-fetcher service (`docker-compose.yml:1-72`; `docker-compose.qa.yml:1-72`). |
| Env template          | `.env`                                                                     | The envsubst source for the droplet `.env` files (`deploy-prod-prodhost.yml:237`; `qa-backend-build-deploy-prodhost.yml:195`).                                                                                                                                      |
| Ansible               | `ansible/`                                                                 | Caddy reverse proxy (`ansible/caddy/`), fail2ban (`ansible/fail2ban/`), cron (`ansible/cron/`), and logrotate (`ansible/logrotate/`).                                                                                                                               |
| Terraform             | `terraform/digitalocean/`                                                  | DigitalOcean droplets, DNS, and firewall modules (`terraform/TERRAFORM.md`).                                                                                                                                                                                        |
| Monitoring            | `monitoring-master/`, `monitoring-agent/`                                  | Prometheus, Grafana, Loki, Blackbox, cAdvisor, Node Exporter, and Redis exporter (`leadminer.io/docs/MONITORING.md`).                                                                                                                                               |
| Redis                 | `redis/`                                                                   | Shared Redis instance on the external `leadminer-net` network (`redis/README.md`).                                                                                                                                                                                  |
| TheDig                | `thedig.env`, `thedig-whitelist`                                           | Runtime env template and whitelist for the single TheDig instance (`leadminer.io/docs/thedig.md`).                                                                                                                                                                  |
| ZAP                   | `zap/rules.tsv`                                                            | OWASP ZAP rules for the scheduled DAST scan (`dast-scan.yml:1-10`).                                                                                                                                                                                                 |
| Supabase artifacts    | `supabase/functions/`, `supabase/migrations/`, `supabase/email-templates/` | Edge-function source, migration source, and email templates.                                                                                                                                                                                                        |
| Data backup           | `data-backup/`                                                             | `s3-backup.sh` and the restore procedure (`data-backup/README.md:88-132`).                                                                                                                                                                                          |

## The deploy chain

The application repository does not deploy itself. A change to `ankaboot-source/leadminer` fires a path-filtered trigger workflow in the application repository. The trigger workflow sends a `repository_dispatch` event to `leadminer.io`. The ops repository runs the deploy workflow.

1. A push to `leadminer/main` touching `backend/**` or `micro-services/**` fires `qa-trigger-backend-build.yml`. That workflow sends `repository_dispatch` with `trigger-qa-backend-build` (`leadminer/.github/workflows/qa-trigger-backend-build.yml:1-30`).
2. `leadminer.io` receives the event in `qa-backend-build-deploy-prodhost.yml` (`qa-backend-build-deploy-prodhost.yml:3-4`).
3. The deploy job SSHs to the host at `vars.LEADMINER_PROD_IP` (`qa-backend-build-deploy-prodhost.yml:105`), resets the app checkout, runs `leadminer-integration.sh` to copy the commercial overlay, renders the compose file from the ops template, and runs `docker compose up -d` (`qa-backend-build-deploy-prodhost.yml:120-203`).
4. The production path starts from a published release in `leadminer`. `prod-trigger.yml` sends `trigger-prod`. `deploy-prod-prodhost.yml` requires manual approval (`deploy-prod-prodhost.yml:7-16`), builds and pushes the frontend image (`deploy-prod-prodhost.yml:18-79`), and SSHs to `vars.LEADMINER_PROD_IP` to deploy (`deploy-prod-prodhost.yml:81-252`).

## Gotchas

### QA is co-located on the prod host for the app stack only

QA and prod app deployments both target `vars.LEADMINER_PROD_IP` (`qa-backend-build-deploy-prodhost.yml:105`; `deploy-prod-prodhost.yml:139`). The QA stack uses `docker-compose.qa.yml` and dedicated ports: `LEADMINER_API_PORT=8121`, `LEADMINER_FRONTEND_PORT=8182`, and `EMAIL_FETCHING_SERVICE_PORT=8183` (`qa-backend-build-deploy-prodhost.yml:190-192`). QA Supabase is a different host (`vars.SSH_HOST_SUPABASE_QA`), not the prod host.

### Frontend image tags are per environment

The prod compose file uses `ankabootorg/leadminer-frontend:latest` (`docker-compose.yml:48`). The QA compose file uses `ankabootorg/leadminer-frontend-qa:latest` (`docker-compose.qa.yml:48`). The two tags are separate.

### The `workflow_run` reference is non-functional

The three QA app-deploy workflows declare `workflow_run: workflows: ["Deploy Supabase"]` (`qa-backend-build-deploy-prodhost.yml:5-6`; `qa-frontend-build-deploy-prodhost.yml:5-6`; `qa-no-build-deploy-prodhost.yml:5-6`). No workflow in `leadminer.io/.github/workflows/` has the name `Deploy Supabase`. The three real triggers are `repository_dispatch`, `workflow_dispatch`, and for `qa-no-build-deploy-prodhost.yml` a `push` to `thedig-whitelist` (`qa-no-build-deploy-prodhost.yml:9-11`). Treat the `workflow_run` reference as non-functional as of `leadminer.io@256a710`.

### The Supabase function tree is append-only

The application repository syncs functions to the ops repository with an `rsync` command that has no `--delete` flag (`leadminer/.github/workflows/push-supabase-functions.yml:22`). The server deploy copies the functions with `cp -r` and no delete (`deploy-supabase-functions-qa.yml:67`; `deploy-supabase-functions-prod.yml:60`). A function deleted upstream is still deployed.

### Two git-tracked env files contain credential-shaped values

`leadminer.io/supabase/functions/.env.dev` and `leadminer.io/supabase/functions/.env.prod` are tracked in git and contain credential-shaped values. Do not read them. See the `doc-health-audit.md` finding. Rotating the credentials and purging the files from git history is a security task outside documentation scope.

## Known gaps

- The deployed Supabase configuration lives only in `deploy-supabase-stack-qa.yml:120-233` on the server. It is not committed to any repository.
- Whether the QA host at `vars.LEADMINER_QA_IP` is in active use for the app stack is not documented. The variable is referenced by four workflows (`update-droplet.yaml:18`, `supabase-storage-upload.yml:31`, `deploy-ansible.yml:62`, `deploy-monitoring.yml:186`).
- The origin of the 13 files present in `supabase/functions` and in neither source repository cannot be recovered from the shallow clone.

## Related docs

- [../../repo-map.md](../../repo-map.md)
- [./AGENTS.md](./AGENTS.md)
- [../../deployment-flow.md](../../deployment-flow.md)
- [../../three-repo-model.md](../../three-repo-model.md)
- [../../../runbooks/supabase-operations.md](../../../runbooks/supabase-operations.md)
