# ADR-005: Separate, mutable `:latest` frontend image tags per environment

## Status

Accepted

## Date

Documented 2026-10-30; original decision date unrecovered (evidence clones are shallow).

## Context

The frontend is built in CI and pushed to Docker Hub. The deployed compose files reference the image tag directly. The two environments need different frontend builds because their Supabase URLs, API hosts, PostHog keys and Sentry environments differ at build time.

## Decision

Each environment publishes its own mutable `:latest` frontend tag, and the compose file for that environment references that tag:

- Prod: `ankabootorg/leadminer-frontend:latest`.
- QA: `ankabootorg/leadminer-frontend-qa:latest`.

Neither tag is immutable. There is no digest pinning, no short-SHA tag and no release tag in the deploy path.

Evidence anchors:

- `leadminer.io@256a710:.github/workflows/deploy-prod-prodhost.yml:79` — `tags: ankabootorg/leadminer-frontend:latest`.
- `leadminer.io@256a710:.github/workflows/qa-frontend-build-deploy-prodhost.yml:72` — `tags: ankabootorg/leadminer-frontend-qa:latest`.
- `leadminer.io@256a710:docker-compose.yml:48` — prod service image `ankabootorg/leadminer-frontend:latest`.
- `leadminer.io@256a710:docker-compose.qa.yml:48` — QA service image `ankabootorg/leadminer-frontend-qa:latest`.

The `AGENTS.md` claim that QA and prod share a frontend image is superseded by this decision. The two tags are distinct in the current files.

## Alternatives considered

- One shared image tag: rejected because the frontend is compiled with environment-specific public configuration (Supabase project URL, API endpoint, PostHog and Sentry settings).
- Immutable per-release tags (`:<sha>`, `:vX.Y.Z`): rejected for this phase in favour of the simpler mutable `:latest` flow. The trade-off is recorded in the consequences.

## Consequences

- Deploying prod or QA pulls whichever image currently carries that tag. A rebuild of the same tag silently changes what the next deploy runs. There is no way to pin a known-good frontend without an out-of-band image digest.
- Reverting the frontend requires rebuilding the image from the reverted commit, because the old tag points at the new build.
- The QA-tested image cannot reach prod by accident, because the tags are separate. The root cause of a prod/QA frontend mismatch is the mutable tag itself, not a shared tag.
- The backend services are built from source on the server and are not affected by this decision.

## Related docs

- [../runbooks/deploy.md](../runbooks/deploy.md)
- [../runbooks/rollback.md](../runbooks/rollback.md)
