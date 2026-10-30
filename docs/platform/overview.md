# Platform overview

> The five-participant topology, host map, component map, runtime topology, and data model for the Leadminer platform. Read this if you are trying to understand what runs where, which repository owns which artifact, and how a request moves through the system.

## TL;DR

- Five participants make a deployable platform: `leadminer`, `leadminer.io`, `leadminer-commercial`, `supabase-selfhost-ops`, and `saas-supabase`.
- The Leadminer app stack for prod and QA runs on one droplet (`vars.LEADMINER_PROD_IP`), separated by ports and compose files (`leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:105`, `leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:139`). The QA and prod Supabase instances run on separate droplets (`vars.SSH_HOST_SUPABASE_QA` / `_PROD`) (`leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:79`, `leadminer.io@256a710:.github/workflows/deploy-supabase-stack-prod.yml:77`). A separate QA host referenced by `vars.LEADMINER_QA_IP` is still used for email-template upload, fail2ban/cron/logrotate, monitoring agents and nightly upgrades (`leadminer.io@256a710:.github/workflows/update-droplet.yaml:18`, `leadminer.io@256a710:.github/workflows/supabase-storage-upload.yml:31`, `leadminer.io@256a710:.github/workflows/deploy-ansible.yml:62`, `leadminer.io@256a710:.github/workflows/deploy-monitoring.yml:186`).
- The app repository owns backend, frontend, edge-function source, migrations source, and micro-services (`leadminer@469c7f8b:README.md:43-160`). It does not own deploy automation, secrets, or runtime compose templates (`leadminer.io@256a710:.github/workflows/`).
- There are two Supabase backends: the self-hosted stack rendered from `supabase-selfhost-ops`, and the hosted `saas-supabase` project the frontend calls directly (`leadminer.io@256a710:saas-supabase/supabase/config.toml:3`, `leadminer@469c7f8b:frontend/src/plugins/api.ts:17-25`).
- The data model puts core contact and mining tables in the `public` schema and campaign, SMS, WhatsApp, SMTP sender, and signature tables in the `private` schema (`leadminer@469c7f8b:supabase/migrations/20241205095428_migrate_to_private_schema.sql`).

## Host map

| Host                | Role                                                                             | Evidence                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leadminer prod host | Runs the prod app stack and the QA app stack on separate ports and compose files | `leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:105`, `leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:139` |
| Supabase QA host    | Runs the self-hosted Supabase stack for QA                                       | `leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:79`                                                                                 |
| Supabase prod host  | Runs the self-hosted Supabase stack for prod                                     | `leadminer.io@256a710:.github/workflows/deploy-supabase-stack-prod.yml:77`                                                                               |
| Monitoring host     | Runs the Prometheus, Grafana, Loki, Blackbox, Uptime-Kuma, and exporter stack    | `leadminer.io@256a710:.github/workflows/deploy-monitoring.yml:63`, `leadminer.io@256a710:docs/MONITORING.md:9`                                           |
| Mail/OVH host       | Runs the OVH Debian mail server, Reacher, and monitoring agents                  | `leadminer.io@256a710:.github/workflows/update-droplet.yaml:126`, `leadminer.io@256a710:docs/oxahost-leadminer-server.md:3`                              |

The environment is selected by the `host:` of the SSH step, not by the Ansible inventory path. Both `inventory/prod/hosts.ini` and `inventory/qa/hosts.ini` contain `localhost ansible_connection=local`; `playbook.all.yml` renders the combined prod and QA Caddyfile (`leadminer.io@256a710:ansible/caddy/leadminer/playbook.all.yml`).

## The five participants

| Participant             | Role                              | Owns                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leadminer`             | Application source                | `backend/`, `frontend/`, `supabase/functions/` source, `supabase/migrations/` source, `micro-services/`, root compose and environment scripts (`leadminer@469c7f8b:README.md:43-160`, `leadminer@469c7f8b:docker-compose.yml:1-111`)                                                                                        |
| `leadminer.io`          | Ops and infrastructure            | Deploy workflows, secrets and variables, runtime `.env` and compose templates, Ansible, Terraform, monitoring, data backup, and the Supabase functions and migrations convergence tree (`leadminer.io@256a710:.github/workflows/`, `leadminer.io@256a710:docker-compose.yml`, `leadminer.io@256a710:data-backup/README.md`) |
| `leadminer-commercial`  | Billing source overlay            | `backend/` and `frontend/` billing code copied into the app checkout at deploy time; it does not touch `supabase/` (`leadminer.io@256a710:leadminer-integration.sh:59-60`)                                                                                                                                                  |
| `supabase-selfhost-ops` | Self-hosted Supabase distribution | The Postgres, GoTrue, PostgREST, Realtime, Storage, Edge Runtime, and Studio stack; Ansible roles; backup, restore, and restore verification (`supabase-selfhost-ops@56638b9:AGENTS.md:16-62`, cloned by `leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml:79`)                                          |
| `saas-supabase`         | Hosted Supabase project           | Its own `config.toml` and functions (`add-mining-source`, `email-templates`, `imap`, `_shared`), called directly by the frontend (`leadminer.io@256a710:saas-supabase/supabase/config.toml:3`, `leadminer@469c7f8b:frontend/nuxt.config.ts:57-58`, `leadminer@469c7f8b:frontend/src/plugins/api.ts:17-25`)                  |

## Component map of the app repository

| Component                   | Runtime                            | Entry points and notes                                                                                                                                                                                                                                                                                                              |
| --------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend API and workers     | Node.js >= 24, Express, TypeScript | API `backend/src/server.ts`; message worker `backend/src/messageWorker.ts`; email verification worker `backend/src/emailVerificationWorker.ts`; signature worker `backend/src/emailSignatureWorker.ts`; PostgreSQL import worker `backend/src/workers/postgresql-import/index.ts` (`leadminer@469c7f8b:backend/package.json:10-23`) |
| Frontend                    | Nuxt 4, Vue 3, Nitro               | `frontend/nuxt.config.ts`; dev server port 8082 (`leadminer@469c7f8b:frontend/nuxt.config.ts:29-33`)                                                                                                                                                                                                                                |
| Edge functions              | Deno, Hono                         | `supabase/functions/`; shared code in `supabase/functions/_shared/`; served locally with `npm run dev:supabase-functions` (`leadminer@469c7f8b:package.json:15`)                                                                                                                                                                    |
| Email fetcher micro-service | Bun, Express                       | `micro-services/emails-fetcher/src/server.ts`; port `EMAIL_FETCHING_SERVICE_PORT`, default 8084 (`leadminer@469c7f8b:micro-services/emails-fetcher/.env.dev:2`)                                                                                                                                                                     |
| SMS gateway mock            | Bun, Express                       | `micro-services/sms-gateway-mock/src/server.ts`; dev-only; port 8085 (`leadminer@469c7f8b:micro-services/sms-gateway-mock/.env.dev:2`)                                                                                                                                                                                              |

## Runtime topology

- The browser calls the frontend, which calls the backend REST API at `${SERVER_ENDPOINT}/api` and forwards the Supabase JWT in `x-sb-jwt` (`leadminer@469c7f8b:frontend/src/plugins/api.ts:6-14`).
- The frontend also calls the hosted `saas-supabase` edge functions at `${SAAS_SUPABASE_PROJECT_URL}/functions/v1/` (`leadminer@469c7f8b:frontend/src/plugins/api.ts:17-25`).
- The backend talks to Supabase for auth, PostgREST, RPC, and storage, and to Postgres directly through `backend/src/db/pg` (`leadminer@469c7f8b:backend/src/db/pg`, `leadminer@469c7f8b:backend/src/utils/supabase.ts`).
- The backend uses Redis for task streams, pub/sub, and caches, with consumer groups for extracting, cleaning, and signature work (`leadminer@469c7f8b:backend/src/messageWorker.ts:40-50`, `leadminer@469c7f8b:backend/src/utils/redis.ts`).
- The backend calls the email-fetcher micro-service through `EmailFetcherClient` and `PSTFetcherClient` using `EMAIL_FETCHING_SERVICE_API_TOKEN` (`leadminer@469c7f8b:backend/src/services/email-fetching/index.ts`, `leadminer@469c7f8b:backend/src/services/email-fetching/pst.ts`).
- Postgres invokes edge functions through `private.invoke_edge_function`, `private.trigger_email_campaign_processor`, and `private.trigger_sms_campaign_processor`, including cron jobs defined in migrations (`leadminer@469c7f8b:supabase/migrations/20260304160000_standardize_edge_function_invocation.sql`, `leadminer@469c7f8b:supabase/migrations/20260226142941_passive_mining_cron_job.sql`).
- Edge functions call external providers for SMTP, SMS, WhatsApp, email verification, enrichment, and LLM signature extraction (`leadminer@469c7f8b:supabase/functions/email-campaigns/sender-options.ts`, `leadminer@469c7f8b:supabase/functions/sms-campaigns/providers/`).

## Data model

- `supabase/migrations/` contains 115 migration files, from `20221109155127_init.sql` to `20260925151610_fix_get_mining_stats_phone_count.sql` (`leadminer@469c7f8b:supabase/migrations/`).
- The `public` schema holds the core contact and mining tables: `persons`, `refinedpersons`, `pointsofcontact`, `organizations`, `tags`, `domains`, `engagement`, `messages`, `mining_sources`, `tasks`, and `profiles` (`leadminer@469c7f8b:supabase/migrations/20221109155127_init.sql`).
- The `private` schema holds campaign, SMS, WhatsApp, SMTP sender, and signature tables: `private.email_status`, `private.email_campaigns`, `private.email_campaign_recipients`, `private.email_campaign_links`, `private.email_campaign_events`, `private.sms_campaigns*`, `private.whatsapp_sessions`, `private.smtp_senders`, `private.sms_fleet_gateways`, and `private.signatures` (`leadminer@469c7f8b:supabase/migrations/20241205095428_migrate_to_private_schema.sql`, `leadminer@469c7f8b:supabase/migrations/20251107141413_add-signature-table.sql`).
- Key RPCs include `refine_persons`, `enrich_contacts`, `get_contacts_table*`, `get_mining_source_overview`, `get_mining_stats`, `get_user_mining_source_credentials`, `contact_temperature`, `invoke_edge_function`, `trigger_email_campaign_processor`, `trigger_sms_campaign_processor`, `get_campaigns_overview`, `get_unified_campaigns_overview`, `get_sms_campaigns_overview`, and gateway quota functions (`leadminer@469c7f8b:supabase/migrations/`).

## The two Supabase backends

The platform has two Supabase backends, and they serve different call paths.

| Backend              | What it serves                                                                                                                                                                                                    | Evidence                                                                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Self-hosted Supabase | Core application data and auth, the app's own edge functions, mining, and campaign processing. The deployed database is assembled from the app and ops migration trees and rendered from `supabase-selfhost-ops`. | `leadminer.io@256a710:.github/workflows/deploy-supabase-stack-qa.yml`, `leadminer.io@256a710:.github/workflows/supabase-migrations-qa.yml`, `leadminer.io@256a710:.github/workflows/supabase-migrations-prod.yml`                       |
| `saas-supabase`      | Hosted functions the frontend calls directly: `add-mining-source`, `email-templates`, `imap`, and the `campaigns-track` tracking endpoints.                                                                       | `leadminer.io@256a710:saas-supabase/supabase/config.toml:3`, `leadminer.io@256a710:saas-supabase/supabase/functions/`, `leadminer@469c7f8b:frontend/src/plugins/api.ts:17-25`, `leadminer@469c7f8b:frontend/src/pages/c/[token].vue:10` |

The frontend also uses the hosted backend for `email-campaigns/campaigns/preview`, `email-campaigns/campaigns/create`, `sms-campaigns/campaigns/preview`, `sms-campaigns/campaigns/create`, `delete-user`, `delete-mining-source`, `sms-fleet/openwa/sessions`, `mining-sources`, and `email-templates` (`leadminer@469c7f8b:frontend/src/components/campaigns/CampaignComposerDialog.vue:939,1009,1126,1184`, `leadminer@469c7f8b:frontend/src/pages/account/settings.vue:322`, `leadminer@469c7f8b:frontend/src/pages/sources.vue:496`).

## Known gaps

- The origin of the 13 files present in `leadminer.io/supabase/functions` and in neither source repository cannot be recovered from the shallow clone. See [The three-repo model](./three-repo-model.md).
- Two `add-mining-source` variants exist in `leadminer.io`; which one is deployed is unrecovered. The app repository has no `add-mining-source`.
- Actual droplet hostnames and usernames beyond the `${{ vars.* }}` and `${{ secrets.* }}` indirection are not documented.
- Whether the S3 backup cron is installed on the database host is not verifiable from the repositories; the wiring is manual (`leadminer.io@256a710:data-backup/README.md:76-86`).

## Related docs

- [Documentation hub](../README.md)
- [The three-repo model](./three-repo-model.md)
- [Deployment flow](./deployment-flow.md)
- [Local development](./local-development.md)
- [Supabase operations](../runbooks/supabase-operations.md)
