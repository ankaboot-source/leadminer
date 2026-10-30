> **Proposal, not live doc.** Copy this file to `leadminer-commercial/AGENTS.md`. It is not read by agents where it sits now, and it is not the platform's source of truth for this repo — see [../../repo-map.md](../../repo-map.md).
> Verified against `leadminer-commercial@1840116` (2026-10-30). Re-verify before copying.

# Agent instructions for `leadminer-commercial`

This repository is a billing source overlay. Read `README.md` for the integration mechanisms. This file gives the rules an agent needs before it edits a billing file, adds an edge-function override, or changes a migration.

## Do not try to run this repository by itself

The repository has no root application, no `docker-compose.yml`, and no backend entry point. It cannot be started on its own (`README.md:1-4`). Use the local-development integration method in `README.md:12-16` or the deploy-time overlay in `leadminer-integration.sh`.

## Integration directions

- **Deploy time:** the ops script clones this repository and copies `backend/*` and `frontend/*` into the application checkout (`leadminer-integration.sh:59-60`). The direction is commercial **into** application.
- **Local development:** the README instructs the developer to copy the open-source application into a clone of this repository (`README.md:12-16`). The direction is application **into** commercial.

Do not describe or use one mechanism for the other's purpose.

## Rules

### Preserve the three rsync excludes

The application repository syncs functions with three excludes: `billing/`, `email-campaigns/middlewares-mod.ts`, and `mail/passive-mining-failed/template.ts` (`leadminer/.github/workflows/push-supabase-functions.yml:22`). Those paths are owned by this repository. Do not remove an exclude without checking that the commercial override is no longer needed.

### Keep the OSS and commercial copies in sync when you edit a shared file

If a file exists in both the open-source application and this repository, edit both. The deploy-time overlay overwrites the open-source file, so the commercial copy wins in production (`README.md:50-51`).

### Do not add an edge function to this repository without adding it to the ops sync

An edge function added here does not deploy by itself. The application repository sync copies the open-source functions into the ops repository; the commercial repository has its own `push-supabase-functions.yml` that copies files into the ops repository (`leadminer-commercial/.github/workflows/push-supabase-functions.yml:22`). Check both paths before assuming a function is deployed.

### Keep billing environment variables in the commercial env file

The commercial edge-function variables live in `supabase/env.commercial.functions` (`supabase/functions/billing/README.md:42-50`). The variables include `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_API_VERSION`, `FRONTEND_HOST`, and `ENABLE_CREDIT`. Do not add them to the open-source env templates.

## Commands

```bash
# List the billing plugin
ls backend/src/utils/billing-plugin

# List the billing edge function
ls supabase/functions/billing

# List the commercial migrations
ls supabase/migrations

# Read the integration instructions
sed -n '1,60p' README.md
```

## Gotchas

- The repository has no `AGENTS.md` today. This file is a proposal.
- The local-development integration uses `rsync --ignore-existing`, which does not overwrite existing commercial files (`README.md:14`).
- The deploy-time integration aborts if the commercial clone fails (`leadminer-integration.sh:35-38`) but only warns if an overlay directory is missing (`leadminer-integration.sh:45-56`).
- The billing edge function and the backend billing plugin are separate implementations. The edge function handles campaign billing, Stripe webhooks, and payment success; the backend handles export and enrichment billing (`supabase/functions/billing/README.md:52-60`).

## Known gaps

- The commercial README does not describe the deploy-time integration script.
- Whether the billing edge function or the backend plugin is authoritative for a given billing path is not documented in one place.

## Related docs

- [./README.md](./README.md)
- [../../repo-map.md](../../repo-map.md)
- [../../three-repo-model.md](../../three-repo-model.md)
- [../../maintenance/doc-health-audit.md](../../maintenance/doc-health-audit.md)
