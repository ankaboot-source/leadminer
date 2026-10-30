> **Proposal, not live doc.** Copy this file to `leadminer-commercial/README.md`. It is not read by agents where it sits now, and it is not the platform's source of truth for this repo — see [../../repo-map.md](../../repo-map.md).
> Verified against `leadminer-commercial@1840116` (2026-10-30). Re-verify before copying.

# Leadminer Commercial

> The billing source overlay for Leadminer. Read this if you are trying to understand how the commercial billing code is integrated into the application, how to develop against it locally, or why it is not a standalone deployable repository.

## TL;DR

- `leadminer-commercial` is a **source overlay**, not a standalone application. It has no root application, no `docker-compose.yml`, and no backend entry point of its own (`README.md:1-4`).
- The deploy-time integration copies `commercial/backend/*` into `app/backend/` and `commercial/frontend/*` into `app/frontend/` (`leadminer-integration.sh:59-60`).
- The local-development integration method is different: it copies the open-source application **into** the commercial repository for editing (`README.md:12-16`).
- It owns the billing plugin, the billing edge function, the commercial overrides of four edge functions, and the commercial migrations.
- Three `rsync` excludes in the application repository protect the commercial-owned paths during the functions sync (`leadminer/.github/workflows/push-supabase-functions.yml:22`).
- The repository has **no `AGENTS.md`** today. The `AGENTS.md` next to this file is a proposal for one.

## Why it is not standalone deployable

The repository contains only overlay directories: `backend/`, `frontend/`, and `supabase/`. It has no `package.json` at the root, no application entry point, and no compose file. The `backend/` directory contains only `src/utils/billing-plugin/**`. The `frontend/` directory contains billing components, billing pages, and billing presets. The `supabase/` directory contains the billing edge function and the commercial migrations (`README.md:48-51`).

A maintainer cannot run the commercial repository by itself. It must be combined with the open-source application.

## Integration mechanisms

There are two integration mechanisms. They copy in opposite directions and serve different purposes.

### Deploy-time overlay (the script in `leadminer.io`)

The deploy workflow runs `leadminer-integration.sh` from the ops repository. The script clones `leadminer-commercial` into a temporary directory and copies the overlay into the application checkout (`leadminer-integration.sh:35-60`).

1. `git clone "$INTEGRATION_REPO_URL" "$LEADMINER_BILLING_FOLDER"` (`leadminer-integration.sh:35`).
2. The script aborts the deploy if the clone fails (`leadminer-integration.sh:35-38`).
3. `cp -r "$BACKEND_COMMERCIAL"/* "$BACKEND_LEADMINER"/` (`leadminer-integration.sh:59`).
4. `cp -r "$FRONTEND_COMMERCIAL"/* "$FRONTEND_LEADMINER"/` (`leadminer-integration.sh:60`).
5. A missing `frontend/` or `backend/` directory in the commercial checkout prints a warning but does not exit (`leadminer-integration.sh:45-56`).

The deploy-time direction is commercial **into** the application checkout. The commercial files overwrite the same-named open-source files. The script does not delete extra files.

### Local-development integration (the README method)

The commercial README instructs a developer to clone both repositories and overlay the open-source application **into** the commercial repository (`README.md:12-16`):

```bash
git clone https://github.com/ankaboot-source/leadminer.git
git clone https://github.com/ankaboot-source/leadminer-commercial.git
rsync -av --ignore-existing --exclude='.git' leadminer/ leadminer-commercial/
cd leadminer-commercial
```

The `rsync` command copies the open-source files into the commercial working tree without overwriting existing commercial files (`--ignore-existing`). The commercial repository becomes the working tree. This is the opposite direction from the deploy-time script. A maintainer who follows the README for a production task will use the wrong integration path.

## What the overlay contains

### Billing plugin (backend)

The Express billing plugin is in `backend/src/utils/billing-plugin/`. It exposes `BillingManager` with `validateCustomerCredits`, `deductCustomerCredits`, `deleteCustomer`, and `expressRouter` (`backend/src/utils/billing-plugin/index.ts:14-30`). It uses Stripe (`backend/src/utils/billing-plugin/index.ts:2`), a Supabase users access layer (`backend/src/utils/billing-plugin/index.ts:5`), and a `CreditsManager` (`backend/src/utils/billing-plugin/index.ts:7`).

### Billing edge function (Supabase)

The billing edge function is in `supabase/functions/billing/`. It handles credit validation, charging, and Stripe webhooks (`supabase/functions/billing/README.md:1-5`). The function is guarded by `ENABLE_CREDIT=true` and the service-role key (`supabase/functions/billing/README.md:64-68`).

### Commercial edge-function overrides

The overlay also overrides four open-source edge functions: `delete-user`, `email-campaigns`, `mail`, and `sms-campaigns` (`supabase/functions/` listing).

### Commercial migrations

The commercial migrations are in `supabase/migrations/`. They add billing columns and default credits, move the commercial schema into the `private` schema, add atomic credit operations, add Stripe webhook idempotency, enable RLS on processed Stripe events, and add campaign engagement types.

## The conflict contract

The application repository's function sync uses three `rsync` excludes: `billing/`, `email-campaigns/middlewares-mod.ts`, and `mail/passive-mining-failed/template.ts` (`leadminer/.github/workflows/push-supabase-functions.yml:22`). Those three paths are commercial-owned. The excludes prevent the open-source sync from overwriting them in `leadminer.io/supabase/functions/`.

Do not remove an exclude without checking whether the commercial repository owns the path. Removing an exclude lets the open-source file overwrite the commercial override in the ops repository.

## Known gaps

- The commercial README does not mention the deploy-time integration script or the three `rsync` excludes.
- The commercial README does not mention the `supabase/functions/billing/README.md` environment variables or the `ENABLE_CREDIT` flag.
- There is no `AGENTS.md` in the repository today.

## Related docs

- [./AGENTS.md](./AGENTS.md)
- [../../repo-map.md](../../repo-map.md)
- [../../three-repo-model.md](../../three-repo-model.md)
- [../../deployment-flow.md](../../deployment-flow.md)
