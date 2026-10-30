# Leadminer platform documentation

This is the entry point for the Leadminer platform documentation set. Read this if you are trying to find the right document for a task, or if you need the commit SHAs the documentation was verified against.

## Verification baseline

| repo                    | verified against | date       |
| ----------------------- | ---------------- | ---------- |
| `leadminer`             | `469c7f8b`       | 2026-10-30 |
| `leadminer.io`          | `256a710`        | 2026-10-30 |
| `leadminer-commercial`  | `1840116`        | 2026-10-30 |
| `supabase-selfhost-ops` | `56638b9`        | 2026-10-30 |
| `thedig`                | `7d16f52`        | 2026-10-30 |

Re-verify with the procedure in [maintenance/doc-health-audit.md](./platform/maintenance/doc-health-audit.md) before trusting any deploy fact.

## Navigation

Platform concepts:

- [Platform overview](./platform/overview.md): participants, hosts, components, runtime topology, data model, Supabase backends.
- [The three-repo model](./platform/three-repo-model.md): how `leadminer`, `leadminer.io`, and `leadminer-commercial` fit together.
- [Deployment flow](./platform/deployment-flow.md): CI/CD chain, QA and prod paths, Supabase path.
- [Repository map](./platform/repo-map.md): all 23 repositories in the organization.
- [Local development](./platform/local-development.md): from-zero development environment.
- [Glossary](./platform/glossary.md): domain terms.
- [Agent workflow](./platform/agents/agentic-workflow.md): how agents work in this platform.
- [Repository agent guidelines](./platform/agents/repo-agent-guidelines.md): per-repository `AGENTS.md` conventions.
- [Documentation health audit](./platform/maintenance/doc-health-audit.md): per-repository documentation status and re-verification procedure.
- [Documentation backlog](./platform/maintenance/backlog.md): prioritized documentation work.
- [Drop-in proposals](./platform/repos/): documentation proposals for sibling repositories. This is a directory, not live documentation.

Onboarding:

- [Newcomer guide](./onboarding/newcomer-guide.md): start here on your first day.
- [First week](./onboarding/first-week.md): day-by-day checklist.

Runbooks:

- [Deploy](./runbooks/deploy.md)
- [Rollback](./runbooks/rollback.md)
- [Incident response](./runbooks/incident-response.md)
- [Secrets and environment](./runbooks/secrets-and-env.md)
- [Supabase operations](./runbooks/supabase-operations.md)
- [Troubleshooting](./runbooks/troubleshooting.md)

Decisions:

- [ADR-001: Deploy through repository dispatch](./decisions/ADR-001-deploy-through-repository-dispatch.md)
- [ADR-002: Billing as a deploy-time source overlay](./decisions/ADR-002-ship-billing-as-deploy-time-source-overlay.md)
- [ADR-003: Converge Supabase artifacts in the ops repository](./decisions/ADR-003-converge-supabase-artifacts-in-ops-repo.md)
- [ADR-004: Co-locate the QA app stack on the prod host](./decisions/ADR-004-co-locate-qa-app-stack-on-prod-host.md)
- [ADR-005: Separate mutable latest frontend image tags](./decisions/ADR-005-separate-mutable-latest-frontend-image-tags.md)
- [ADR-006: Tolerate out-of-order cross-repo migrations](./decisions/ADR-006-tolerate-out-of-order-cross-repo-migration-versions.md)
- [ADR-007: Apply migrations by two mechanisms](./decisions/ADR-007-apply-migrations-by-two-mechanisms.md)
- [ADR-008: Render the Supabase stack and mutate templates](./decisions/ADR-008-render-supabase-stack-and-mutate-templates.md)
- [ADR-009: Platform documentation hub location](./decisions/ADR-009-platform-docs-hub-location.md)

## Where do I start?

| I want to...                    | Start here                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Understand the platform         | [Platform overview](./platform/overview.md), then [The three-repo model](./platform/three-repo-model.md)      |
| Run the stack locally           | [Local development](./platform/local-development.md) and the [Newcomer guide](./onboarding/newcomer-guide.md) |
| Deploy or understand deployment | [Deployment flow](./platform/deployment-flow.md), then the [Deploy runbook](./runbooks/deploy.md)             |
| Diagnose a failure              | [Troubleshooting](./runbooks/troubleshooting.md) and [Incident response](./runbooks/incident-response.md)     |
| Work as or with an agent        | [Agent workflow](./platform/agents/agentic-workflow.md) and the repository [AGENTS.md](../AGENTS.md)          |
| Work on a sibling repository    | [Repository map](./platform/repo-map.md) and the [drop-in proposals](./platform/repos/)                       |

## How this doc set is organised

The set follows the layering rule from `l5-agentic-docs-standards.md` §2.2 and §3.2: `README.md` is for humans, the root `AGENTS.md` is the agent entry point, `docs/` holds maintainer material, `docs/runbooks/` holds operator procedures, and `docs/decisions/` holds architecture decision records. A fact is owned by exactly one file in this set; every other file links to the owner instead of restating it. Cross-repository facts are owned here only when the owning repository has no `AGENTS.md` or `docs/` entry for them; otherwise the document names the owning file as authority and carries the citation `repo@sha:path:line` (authoring contract §6). Do not copy a fact between layers.

## Related docs

- [Platform overview](./platform/overview.md)
- [The three-repo model](./platform/three-repo-model.md)
- [Local development](./platform/local-development.md)
- [Documentation health audit](./platform/maintenance/doc-health-audit.md)
