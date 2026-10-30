# ADR-002: Ship billing as a deploy-time source overlay, not a fork or a build flag

## Status

Accepted

## Date

Documented 2026-10-30; original decision date unrecovered (evidence clones are shallow).

## Context

The `leadminer-commercial` repo contains the Stripe billing plugin, the frontend credits surface, the billing migrations and the commercial overrides of four OSS edge functions. It has no root application of its own: no root Dockerfile, no API entrypoint and no `docker-compose.yml`.

## Decision

The commercial repo is merged into the application checkout at deploy time by `leadminer-integration.sh`. The script clones the commercial repo into a temporary directory, then copies its `backend/*` and `frontend/*` trees over the app checkout. It aborts the deploy if the commercial clone fails. A missing overlay subdirectory produces a warning, not an exit. The script does not touch `supabase/`.

Evidence anchors:

- `leadminer.io@256a710:leadminer-integration.sh:35-38` — `git clone "$INTEGRATION_REPO_URL" "$LEADMINER_BILLING_FOLDER"` aborts on failure.
- `leadminer.io@256a710:leadminer-integration.sh:45-52` — missing commercial `frontend/` or `backend/` directory produces a warning only.
- `leadminer.io@256a710:leadminer-integration.sh:59-60` — `cp -r "$BACKEND_COMMERCIAL"/* "$BACKEND_LEADMINER"/` and the equivalent frontend copy.
- `leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:34-37` — the prod build job runs the integration script before building the frontend image.
- `leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:198-200` — the QA deploy re-runs the integration script on the server before rebuilding backend services.

## Alternatives considered

- A separate commercial deployment: rejected because the commercial code has no standalone entrypoint and depends on the app tree.
- A build flag inside `leadminer`: rejected because the commercial repo is a separate private repo with its own release cadence.
- A git submodule: the deploy script uses a clone plus `cp -r`, which means the commercial overlay overwrites same-named files but never deletes files from the app tree.

## Consequences

- Billing code is only present in the container after the deploy script has run. Running the app locally without the overlay gives the OSS stubs (`backend/src/utils/billing-plugin/index.ts`).
- Because the copy is additive, a file removed from `leadminer-commercial` remains in the app checkout until a clean clone. The QA deploy re-runs the integration script after `git reset --hard origin/main` so backend images rebuilt by `docker compose up` do not fall back to OSS-only source (`qa-frontend-build-deploy-prodhost.yml:225-230`).
- The two repos must be version-compatible: the overlay is applied unconditionally at deploy time, not pinned to a tag.

## Related docs

- [../runbooks/deploy.md](../runbooks/deploy.md)
- [../platform/three-repo-model.md](../platform/three-repo-model.md)
