# ADR-001: Deploy through `repository_dispatch` into a separate ops repo

## Status

Accepted

## Date

Documented 2026-10-30; original decision date unrecovered (evidence clones are shallow).

## Context

The `leadminer` application repo must trigger deployments without holding deploy secrets or runtime templates. The deploy automation, secrets and runtime templates provisioned in the `leadminer.io` ops repo are not available inside the application repo.

## Decision

Deployments are triggered by a `repository_dispatch` event from `leadminer` into `leadminer.io`. The app repo only contains dispatcher workflows that send a `curl` request to the GitHub API; all build, deploy and runtime-template logic lives in `leadminer.io`.

Evidence anchors:

- `leadminer@469c7f8b:.github/workflows/qa-trigger-no-build.yml:19-31` — a single `curl` posts to `/repos/ankaboot-source/leadminer.io/dispatches` with `event_type=trigger-qa-no-build`.
- `leadminer@469c7f8b:.github/workflows/prod-trigger.yml:19-25` — the prod dispatcher posts `event_type=trigger-prod`.

## Alternatives considered

- Deploy directly from `leadminer` CI, which would require copying every deploy secret and runtime template into the application repo and duplicating the ops workflows.
- Deploy from a manual script on the droplet, which would break the automated QA path from a push to `main`.

## Consequences

- The app repo has no deploy secrets and no deploy templates; it only sends a dispatch event.
- A change to the dispatch mechanism requires editing both repos. The dispatch names (`trigger-qa-backend-build`, `trigger-qa-frontend-build`, `trigger-qa-no-build`, `trigger-prod`) are the contract between them.
- The ops repo is the single place where runtime templates and secrets are rendered, so inspecting a deployed container requires reading `leadminer.io` files, not `leadminer` files.

## Related docs

- [../runbooks/deploy.md](../runbooks/deploy.md)
- [../platform/three-repo-model.md](../platform/three-repo-model.md)
