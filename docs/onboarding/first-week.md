# First week

> Audience: a new maintainer who has finished the [newcomer guide](./newcomer-guide.md). Time budget: one working week, roughly two to four focused hours per day.

## TL;DR

- Day 1 is the local environment. Do not move on until the backend tests pass.
- Day 2 is the architecture and the data model.
- Day 3 is the development workflow and a first PR.
- Day 4 is database and migration safety.
- Day 5 is deployment and QA. Read the ops docs, but do not deploy anything.

## Before you start

Complete every item in the [newcomer guide](./newcomer-guide.md), including the checklist. If the backend unit tests do not pass, fix that before starting Day 1.

## Day 1 — Local environment

- [ ] Run the newcomer guide end to end.
- [ ] Read the root `README.md` and `AGENTS.md`.
- [ ] Open `http://localhost:8082` and click through the mining wizard.
- [ ] Run `cd backend && npm run test:unit` and confirm it passes.
- [ ] Run `cd frontend && npm run test -- --run` and confirm it passes.
- [ ] Record any command that failed and why. This is the first contribution you can make: fix the doc or the setup.

## Day 2 — Architecture and data model

- [ ] Read the [platform overview](../platform/overview.md) for the five participants and the host map.
- [ ] Read the [three-repo model](../platform/three-repo-model.md) to understand why `leadminer` does not deploy itself.
- [ ] Read the [repo map](../platform/repo-map.md) to see which repos are core, supporting, and side projects.
- [ ] Read the [glossary](../platform/glossary.md), especially `mining`, `pipeline`, `task`, `watermark`, `contact`, `person`, and `campaign`.
- [ ] Open `backend/src/services/tasks-manager-v2/` and trace one pipeline from `Pipeline.ts` to `FetchTask.ts` to `ExtractTask.ts`.
- [ ] Open `supabase/migrations/` and read the initial migration plus one recent migration.

## Day 3 — Development workflow and first PR

- [ ] Read the [agentic workflow](../platform/agents/agentic-workflow.md) and [repo agent guidelines](../platform/agents/repo-agent-guidelines.md).
- [ ] Confirm which subproject you are changing. Backend uses Node and Jest; frontend uses Nuxt and Vitest; edge functions use Deno; the emails-fetcher uses Bun. Do not mix commands.
- [ ] Pick a small issue from the GitHub issue tracker.
- [ ] Create a branch with the `feat/`, `fix/`, or `docs/` prefix (`AGENTS.md:241`).
- [ ] Make the change and run the relevant tests plus `npm run lint:fix && npm run prettier:fix` (`AGENTS.md:449-454`).
- [ ] Run `npm run precommit:check` before committing (`AGENTS.md:243`, `package.json:27`).
- [ ] Open the PR. If it closes an issue, include `Resolves #<issue-number>` in the body (`AGENTS.md:251-254`).
- [ ] Do not merge it yourself. A human always merges (`../platform/agents/agentic-workflow.md`).

### First PR walkthrough

1. Branch: `git checkout -b fix/<short-description>`.
2. Change only the relevant subproject.
3. Run the subproject's tests:
   - Backend: `cd backend && npm run test:unit`.
   - Frontend: `cd frontend && npm run test -- --run`.
   - Emails fetcher: `cd micro-services/emails-fetcher && npm run test:unit`.
4. Format and lint: `npm run lint:fix && npm run prettier:fix` from the subproject, or the root script for backend and frontend (`AGENTS.md:449-454`).
5. Commit with an imperative, lowercase message (`AGENTS.md:242`).
6. Push and open the PR.
7. Expect a human review. The current repo has no agent gate, so the review is manual.

## Day 4 — Database and migration safety

- [ ] Read the DB change safety process in the [agentic workflow](../platform/agents/agentic-workflow.md#db-change-safety-process).
- [ ] Read the migrations in `supabase/migrations/`. Note that they are append-only and timestamp-prefixed.
- [ ] Read the [rollback runbook](../runbooks/rollback.md) to understand what is and is not reversible.
- [ ] Read one migration that adds a table and one that changes a function signature.
- [ ] Identify where RLS is enabled and how policies use `auth.uid()`.

Every schema change follows the six-step process: classify risk, obtain approval, write safely, validate, write a rollback plan, and have a human apply it. The automation that enforces this exists in `wikiadviser`, not in `leadminer` today.

## Day 5 — Deployment and QA

- [ ] Read the [deployment flow](../platform/deployment-flow.md).
- [ ] Read the [Supabase operations runbook](../runbooks/supabase-operations.md).
- [ ] Read the [secrets and environment runbook](../runbooks/secrets-and-env.md). Do not read `.env.prod` or `.env.dev` under `supabase/functions/`; they are forbidden sources.
- [ ] Read the [troubleshooting runbook](../runbooks/troubleshooting.md).
- [ ] Read the [documentation backlog](../platform/maintenance/backlog.md) to see which docs are still missing.
- [ ] Ask for read-only access to the QA server. Do not deploy, restart, or run migrations on Day 5.

## Checklist

- [ ] Day 1: local stack runs and backend tests pass.
- [ ] Day 2: you can explain the pipeline and the difference between a person, a contact, and a point of contact.
- [ ] Day 3: you have opened a PR and run the pre-commit checks.
- [ ] Day 4: you can classify a schema change as low or high risk and write a rollback plan.
- [ ] Day 5: you know which repo owns deployment and why `leadminer` does not.

## Where to get help

- Open an issue at `https://github.com/ankaboot-source/leadminer/issues` (`README.md:172`).
- Ask the maintainer who reviewed your PR.
- Read the [glossary](../platform/glossary.md) before asking what a term means.

## Known gaps

- There is no structured onboarding buddy process in the repo. This checklist is the substitute.
- The DB change safety process is documented from the `wikiadviser` precedent. `leadminer` does not yet enforce it with a CI gate; see the [agentic workflow](../platform/agents/agentic-workflow.md).
- QA access is not documented in this repo. Ask a maintainer.

## Related docs

- [Newcomer guide](./newcomer-guide.md)
- [Agentic workflow](../platform/agents/agentic-workflow.md)
- [Repo agent guidelines](../platform/agents/repo-agent-guidelines.md)
- [Glossary](../platform/glossary.md)
- [Platform overview](../platform/overview.md)
- [Local development](../platform/local-development.md)
- [Deployment flow](../platform/deployment-flow.md)
- [Rollback](../runbooks/rollback.md)
- [Troubleshooting](../runbooks/troubleshooting.md)
