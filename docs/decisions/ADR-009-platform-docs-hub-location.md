# ADR-009: Platform documentation hub lives in the app repo, with per-repo drop-ins as proposals

## Status

Accepted

## Date

Documented 2026-10-30; original decision date unrecovered (evidence clones are shallow).

## Context

The platform spans five repositories: `leadminer`, `leadminer.io`, `leadminer-commercial`, `supabase-selfhost-ops` and the hosted `saas-supabase` project. Maintainers and agents need one navigable documentation set. The sibling repos have no shared documentation directory, and several have no `AGENTS.md` at all.

## Decision

The platform documentation hub lives in `docs/` in the `leadminer` app repo. Every doc in the set is owned by exactly one file. Cross-repo facts are owned by the hub only when the owning repo has no `AGENTS.md` or `docs/` entry for them; otherwise the hub names the owning file as authority and links to it.

Per-repo guidance for the seven platform-critical sibling repos is shipped as drop-in proposals under `docs/platform/repos/<repo>/`. These are proposals to copy into the sibling repo, not live documentation at their current path.

Evidence anchors:

- `leadminer@469c7f8b:docs/` — the docs tree created by this effort.
- `leadminer@469c7f8b:scripts/check-forbidden-paths.sh:10` — the pre-commit guard allows `docs/platform/`, `docs/onboarding/`, `docs/runbooks/` and `docs/decisions/`.

## Alternatives considered

- A dedicated `leadminer-docs` repo: rejected for this phase because edit access is one person plus agents, and the app repo gives reviewability and version coupling. Recorded as a P2 backlog item in case maintainers outside `leadminer` need edit rights without code PRs.
- Hub-only documentation with no per-repo drop-ins: rejected because `leadminer.io` and `leadminer-commercial` have no `AGENTS.md`, so an agent working in those repos would get no guidance.
- Branches in all 23 sibling repos: rejected because it would create unreviewed branches outside the task's scope.

## Consequences

- A reader of the hub sees one coherent set; a reader inside a sibling repo sees the same guidance only after a maintainer copies the drop-in proposal.
- The hub can drift from the sibling repo it describes. The mitigation is the single verification table in [../README.md](../README.md) and the re-verification procedure in [../platform/maintenance/doc-health-audit.md](../platform/maintenance/doc-health-audit.md).
- Cross-repo facts carry a `repo@sha:path:line` citation, so a stale SHA is visible.

## Related docs

- [../README.md](../README.md)
- [../platform/maintenance/backlog.md](../platform/maintenance/backlog.md)
