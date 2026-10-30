# Glossary

> Domain and platform terms used across the documentation set. Read this if a doc or a code comment assumes a term you do not know.

## TL;DR

- Every entry is one term, a one-to-three sentence definition, and a link to the code or document that owns the detail.
- Terms are alphabetized.
- The `private` schema holds most of the data model; many tables moved there from `public` (`supabase/migrations/20241205095428_migrate_to_private_schema.sql`).

## A–F

### Billing

The billing plugin charges or validates credits for enrichment and campaign actions. The OSS implementation is a null stub; the commercial implementation lives in `leadminer-commercial` (`backend/src/utils/billing-plugin/index.ts:19`).

### Campaign

An email campaign is a `private.email_campaigns` row. Its recipients, links, and events live in the matching `email_campaign_*` tables (`supabase/migrations/20260214130000_add_email_campaigns.sql:23-79`).

### CI

Continuous integration. The app repo runs `.github/workflows/ci.yml` on pushes to `main` and `.github/workflows/ci-pr.yml` on pull requests. Both run backend unit tests, lint, and formatting; the frontend test step is commented out (`ci.yml:47-48`).

### Consent / unsubscribe

Consent is stored in `private.contact_consent_status`, which defaults to `legitimate_interest` (`supabase/migrations/20260214190000_add_consent_status_and_unsubscribe.sql:9-19`). Campaign email templates append an unsubscribe link and the campaign function serves it at `/unsubscribe/:token` (`supabase/functions/email-campaigns/index.ts:67,432`).

### Consumer group

A Redis Streams consumer group is the named group each worker uses to read a stream. The group names are configured by `REDIS_EXTRACTING_STREAM_CONSUMER_GROUP` and its siblings (`backend/src/config/schema.ts:36-40`).

### Contact

A contact is a row in `private.contacts_view`, the view the contact table reads. It merges person fields with point-of-contact data (`supabase/migrations/20260821020000_contacts_view_stable_id_person_ids.sql:17`).

### Contact temperature

A 0–100 score computed by `private.contact_temperature` from sender count, recipient count, conversations, replies, recency, and seniority (`supabase/migrations/20251007133948_refinedpersons_add_coulmn_temperature_score.sql:3-48`).

### Credits

Credits are the billing unit consumed by enrichment and campaign actions. The OSS billing interface exposes `validateCustomerCredits` and `deductCustomerCredits`; the OSS implementation is null (`backend/src/utils/billing-plugin/index.ts:4-20`).

### DAST

Dynamic application security testing. The ops repo runs a weekly ZAP full scan against `app-qa.leadminer.io` (`leadminer.io@256a710:.github/workflows/dast-scan.yml:1,36-40`).

### DKIM

DomainKeys Identified Mail, a DNS-based email authentication record. `leadminer.io` documents adding DKIM, DMARC, and SPF records to DNS (`leadminer.io@256a710:docs/MAIL-SERVER.md:24`).

### DMARC

Domain-based Message Authentication, Reporting, and Conformance, a policy built on SPF and DKIM. See the mail-server doc for the records to add to DNS (`leadminer.io@256a710:docs/MAIL-SERVER.md:24`).

### Edge function

A Deno function under `supabase/functions/`, mounted as a Hono app and invoked over HTTP or by a Postgres RPC (`supabase/functions/email-campaigns/deno.json:1-11`; `supabase/migrations/20260304160000_standardize_edge_function_invocation.sql:5`).

### Email status / verification

`public.email_status` stores the verification result for an email: `VALID`, `RISKY`, `INVALID`, or `UNKNOWN` (`supabase/migrations/20241122141012_add-email-status-table.sql`). The verifier providers live under `backend/src/services/email-status/`.

### Engagement

A `private.engagement` row records a positive interaction type for a person, such as `CSV` or `ENRICH` (`supabase/migrations/20221109155127_init.sql:17-28`). The table was later re-keyed by `person_id` (`supabase/migrations/20260603120000_drop_person_email_use_persons_id.sql:262-297`).

### Enrichment

The enrichment engine resolves additional contact data from providers. The engine and provider clients live under `backend/src/services/enrichment/` (`backend/src/services/enrichment/index.ts:1-30`).

### Fleet gateway

A `private.sms_fleet_gateways` row stores one gateway in a fleet of SMS gateways, including its provider, limits, and counters (`supabase/migrations/20260327000000_add_sms_fleet_mode.sql:4`).

## G–M

### IMAP

Internet Message Access Protocol. The emails-fetcher microservice uses `imapflow` and `imap` to read mailboxes (`micro-services/emails-fetcher/package.json:7-18,41-42`).

### Mining (active vs passive)

Active mining is user-initiated through the backend API (`backend/src/routes/mining.routes.ts:51-81`). Passive mining is a scheduled run of the `passive-mining` edge function, registered by a cron job (`supabase/migrations/20260226142941_passive_mining_cron_job.sql:51`).

### Mining source

A `private.mining_sources` row holds the identity and encrypted credentials of a connected mailbox (`supabase/migrations/20241205095428_migrate_to_private_schema.sql:209`).

## N–S

### OpenWA

The WhatsApp gateway client used by the WhatsApp campaign functions (`supabase/functions/_shared/openwa-client.ts:1`).

### Organization

A `private.organizations` row describes an organization, optionally linked to a domain (`supabase/migrations/20221109155127_init.sql:114-137`).

### Person

A `private.persons` row is the canonical identity for an email address and user (`supabase/migrations/20221109155127_init.sql:138`; moved to `private` in `supabase/migrations/20241205095428_migrate_to_private_schema.sql:266`).

### PITR

Point-in-time recovery. `supabase-selfhost-ops` documents pgBackRest continuous WAL archiving and PITR (`supabase-selfhost-ops@56638b9:README.md:36`). The backup role is not enabled for Leadminer (`supabase-selfhost-ops@56638b9:env/supabase.yml:262`).

### pgBackRest

The backup tool used by the `supabase-selfhost-ops` backup role (`supabase-selfhost-ops@56638b9:README.md:312`).

### Pipeline

A `Pipeline` coordinates the tasks for one mining run, from fetch through extraction, cleaning, and signature extraction (`backend/src/services/tasks-manager-v2/Pipeline.ts:35`).

### Point of contact

A `private.pointsofcontact` row links a person to a message and records the role: `from`, `reply_to`, `to`, `cc`, `bcc`, or `body` (`supabase/migrations/20221109155127_init.sql:171-186`).

### PostgREST schema cache

The cache PostgREST uses to resolve tables and functions. A stale cache after a migration produces errors such as `CONTACTS_FETCH_FAILED` (`supabase/functions/email-campaigns/index.ts:1347`). Reload it with `NOTIFY pgrst, 'reload schema';` (session-derived; see `../runbooks/troubleshooting.md`).

### Private schema

The non-public Postgres schema holding most of the data model. PostgREST exposes it through `schemas = ["private", "graphql_public"]` (`supabase/config.toml:12`).

### Pub/sub

Redis publish/subscribe. Pipelines use it for cross-process communication over `REDIS_PUBSUB_COMMUNICATION_CHANNEL` (`backend/src/config/schema.ts:35`).

### QA

The QA environment. The app stack runs on the production host with its own compose file and ports (`leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml`). QA Supabase runs on a separate host.

### Reacher

An email verification provider (`backend/src/services/email-status/reacher/client.ts:1`).

### Recipient

A `private.email_campaign_recipients` row represents one person in a campaign, with its own status (`supabase/migrations/20260214130000_add_email_campaigns.sql:46`).

### Redis stream

The append-only log used to pass messages between the API and the workers. It is configured by `REDIS_EXTRACTING_STREAM_CONSUMER_GROUP` and related variables (`backend/src/config/schema.ts:36-40`).

### RLS

Row Level Security. Tables enable RLS and add policies scoped to `auth.uid()` (for example `supabase/migrations/20221109155127_init.sql:30-32`).

### RPC

Remote Procedure Call. In this platform an RPC is a Postgres function invoked through Supabase (for example `supabase/migrations/20221109155538_add_functions.sql:19`).

### Sender

The sending identity used for a campaign. In the current schema it is an SMTP sender. See [SMTP sender](#smtp-sender).

### Short token

An 8-character random token generated by `generateShortToken`, used for tracking and unsubscribe links (`supabase/functions/_shared/short-token.ts:5-20`).

### Signature extraction

The signature service extracts contact fields from email signatures using a regex engine and LLM engines (`backend/src/services/signature/llm/types.ts:11-17`).

### SMS campaign

A `private.sms_campaigns` row represents an SMS campaign; recipients and unsubscribes live in the matching `sms_campaign_*` tables (`supabase/migrations/20260317000000_add_sms_campaigns.sql:33-77`).

### SMTP

Simple Mail Transfer Protocol. Campaign email is sent through nodemailer using SMTP sender credentials (`backend/package.json:62`; `supabase/migrations/20260530120000_add_smtp_senders.sql:1`).

### SMTP sender

A `private.smtp_senders` row stores the sender identity, SMTP host and port, encryption, and either password or OAuth credentials (`supabase/migrations/20260530120000_add_smtp_senders.sql:1-20`).

### SPF

Sender Policy Framework, a DNS record that authorizes sending IPs. See the mail-server doc for the records to add to DNS (`leadminer.io@256a710:docs/MAIL-SERVER.md:24`).

### SSE

Server-Sent Events. The backend streams mining progress to the browser over SSE (`backend/src/utils/helpers/sseHelpers.ts:2`; `frontend/src/utils/sse.ts:2-3`).

## T–Z

### Task

A unit of the mining pipeline. The `TaskType` enum defines `fetch`, `extract`, `clean`, `enrich`, `signature`, and `google-contacts-fetch` (`backend/src/db/types.ts:173-180`; `backend/src/services/tasks-manager-v2/tasks/Task.ts:27`).

### TheDig

An enrichment provider called over HTTP with an API key (`backend/src/services/enrichment/thedig/client.ts:1`).

### UID / uidvalidity

A UID is the IMAP per-message identifier. `uidvalidity` identifies the mailbox generation; if it changes, persisted UIDs are invalid (`micro-services/emails-fetcher/src/services/imap/types.ts:4-6,52`).

### Vault

Supabase Vault, used to store secrets such as `service_role_key` and `project_url` for edge-function invocation (`supabase/migrations/20260304160000_standardize_edge_function_invocation.sql:5`).

### Watermark

A per-folder UID cursor emitted at the end of a fetch and persisted on the fetch task. The next run resumes from it (`micro-services/emails-fetcher/src/services/imap/watermark.ts:9`; `backend/src/services/tasks-manager-v2/tasks/FetchTask.ts:112-131`).

### WhatsApp channel

SMS campaigns have a `channel` column that accepts `sms` or `whatsapp` (`supabase/migrations/20260601000000_add_whatsapp_gateway.sql:4`). A `private.whatsapp_sessions` row manages one WhatsApp session (`supabase/migrations/20260601000000_add_whatsapp_gateway.sql:18`).

## Known gaps

- The `PostgREST schema cache` definition is supported by a session-derived failure mode, not by a code path that reloads the cache. The runbook link records the action.
- The glossary does not define every column in every table. For the full data model, read the migrations under `supabase/migrations/`.
- Branding terms such as "Leadminer" and "leadminer.io" are intentionally not separate entries. `leadminer.io` is both the ops repo name and a legacy package name; the product is `leadminer` (`backend/package.json:2`).

## Related docs

- [Platform overview](./overview.md)
- [Three-repo model](./three-repo-model.md)
- [Local development](./local-development.md)
- [Agentic workflow](./agents/agentic-workflow.md)
- [Repo agent guidelines](./agents/repo-agent-guidelines.md)
- [Supabase operations](../runbooks/supabase-operations.md)
