# Repository agent guidelines

> Rules for the `AGENTS.md` files agents read in this org, a per-repo status table, and the conventions that differ by subproject. Read this if you are writing or reviewing an `AGENTS.md`, or if an agent is giving you advice that contradicts the code.

## TL;DR

- `AGENTS.md` is the single cross-agent source of truth. `CLAUDE.md` must start with `@AGENTS.md` and add only Claude-specific instructions. Do not symlink the two files.
- Nested `AGENTS.md` files are allowed per subproject. The nearest file in the directory tree wins.
- Keep each file under 200 lines. Only write down what an agent cannot find by reading the repo.
- 8 of the 23 org repos have an `AGENTS.md` today. The core ops and billing repos (`leadminer.io`, `leadminer-commercial`) have none.
- The four subprojects in `leadminer` use different runtimes and conventions; an agent must not apply one subproject's rules to another.

## `AGENTS.md` vs `CLAUDE.md`

`AGENTS.md` is the single source of truth for all coding agents (`AGENTS.md` convention, stewarded by the Agentic AI Foundation).

If a repo also needs Claude Code-specific instructions, add a `CLAUDE.md` whose first line is `@AGENTS.md`. Put only Claude-only rules below the import. Claude Code reads `CLAUDE.md` and, by default, ignores `AGENTS.md` when a `CLAUDE.md` exists in the same directory, so the import is what keeps the shared rules in force (`l5-agentic-docs-standards.md:33-35,194-202`).

Do not symlink `CLAUDE.md` to `AGENTS.md`. The import is cross-platform and does not break the Edit/Write tools (`l5-agentic-docs-standards.md:200-202`).

## Nested `AGENTS.md`

Place an `AGENTS.md` at the root of the repo and, when a subproject has different commands or conventions, another one inside that subproject. Agents read the nearest file in the directory tree, and the closest file takes precedence (`l5-agentic-docs-standards.md:25,80-86`).

For `leadminer`, the intended nesting is `backend/`, `frontend/`, `micro-services/emails-fetcher/`, and `supabase/functions/` (recorded as a P1 item in `../maintenance/backlog.md`). Today only the root `AGENTS.md` exists.

## The 200-line target and anti-drift

Aim for fewer than 200 lines per file (`l5-agentic-docs-standards.md:10,74`). Long files consume context and reduce adherence.

The anti-drift rule is: **only write down what an agent cannot find by reading the repo** (`l5-agentic-docs-standards.md:212`). If a fact is derivable from the code in under a minute, link to the code instead of restating it. Restated facts go stale silently.

When you discover a non-obvious gotcha or a rule that has already been corrected twice, add it to `AGENTS.md`. Do not add generic advice, file layout descriptions, or a restatement of the test framework (`l5-agentic-docs-standards.md:57-68`).

## Per-repo status

Checked against the default branch of each repo in `ankaboot-source` on 2026-10-30. `AGENTS.MD` is reported separately because the case matters on case-sensitive filesystems.

| Repo                        | `AGENTS.md` | `CLAUDE.md` | Notes                                        |
| --------------------------- | ----------- | ----------- | -------------------------------------------- |
| `leadminer`                 | yes         | no          | Root file only; 469 lines, over the target   |
| `leadminer.io`              | no          | no          | Core ops repo; has `docs/` but no agent file |
| `leadminer-commercial`      | no          | no          | Billing overlay; only `README.md`            |
| `thedig`                    | no          | no          | Core enrichment engine                       |
| `supabase-selfhost-ops`     | yes         | no          | 300+ lines with operating recipes            |
| `m3llm`                     | yes         | no          |                                              |
| `wikiadviser`               | yes         | no          | 147 lines; the working agentic precedent     |
| `openweb-proxy`             | no          | no          | `CONTRIBUTING.rst` only                      |
| `urgence-palestine`         | no          | no          | Nested `traefik/AGENTS.md` only              |
| `email-open-data`           | no          | no          |                                              |
| `boucle`                    | yes         | no          |                                              |
| `boucle.dev`                | yes         | no          |                                              |
| `claude-code-proxy`         | yes         | no          |                                              |
| `pdwn`                      | yes         | no          |                                              |
| `opencode-thaura`           | no          | no          |                                              |
| `imap-autoconfig`           | no          | no          |                                              |
| `node-imap`                 | no          | no          | Fork of `mscdex/node-imap`                   |
| `email-signature-extractor` | no          | no          | `README.md` is one line                      |
| `casa-webapp-guide`         | no          | no          |                                              |
| `leadminer.io-website`      | `AGENTS.MD` | yes         | Non-standard uppercase filename              |
| `.github`                   | no          | no          | Org profile meta-repo                        |
| `IAM-Benchmark`             | no          | no          | `README.md` is one line                      |
| `manjaro-skill`             | no          | no          | Uses `SKILL.md` instead                      |

Two conventions need attention:

- `leadminer.io-website` uses `AGENTS.MD` rather than the standard `AGENTS.md`. Check the exact filename before assuming an agent will discover it.
- `.github` and `IAM-Benchmark` are meta or dormant repos. Their lack of an `AGENTS.md` is a low-priority gap, not a blocker.

## Platform conventions by subproject

These are the differences an agent must respect. Do not apply one subproject's commands or style to another.

| Subproject                       | Runtime                       | Framework and libraries                                                   | Source                                                                                      |
| -------------------------------- | ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `backend/`                       | Node.js >= 24                 | Express 4, TypeScript strict, Zod for env and request validation          | `backend/package.json:1-127`, `backend/src/config/schema.ts:1`                              |
| `frontend/`                      | Node.js >= 24 (build and dev) | Nuxt 4, Vue 3 Composition API, Pinia, PrimeVue 4, Tailwind 4              | `frontend/package.json:20-59`, `frontend/nuxt.config.ts:1-32`                               |
| `supabase/functions/`            | Deno                          | Hono app per function, shared structured logger, Zod for env and payloads | `supabase/functions/email-campaigns/deno.json:1-11`, `supabase/functions/_shared/logger.ts` |
| `micro-services/emails-fetcher/` | Bun >= 1.1                    | Express, TypeScript, Jest for unit and integration tests                  | `micro-services/emails-fetcher/package.json:7-18,89-91`                                     |

Rules that apply across all four:

- File names are kebab-case (`AGENTS.md:96-105`).
- Classes are PascalCase, functions are camelCase, constants are SCREAMING_SNAKE_CASE (`AGENTS.md:96-105`).
- Do not hand-edit `database.types.ts`; regenerate it (`wikiadviser@282e563:docs/db-change-checklist.md:30`).
- Do not invent commands. If a command in an `AGENTS.md` does not exist in the corresponding `package.json`, fix the doc rather than the code.

## Known gaps

- The per-repo status reflects each repo's default branch on 2026-10-30. Re-check before relying on a row.
- The root `AGENTS.md` for `leadminer` is 469 lines, well over the 200-line target. Reducing it and adding nested files is a P1 backlog item (`../maintenance/backlog.md`).
- `leadminer.io` and `leadminer-commercial` have no agent file. Proposed drop-in files exist under `../repos/`, but they are proposals, not live docs.

## Related docs

- [Agentic workflow](./agentic-workflow.md)
- [Glossary](../glossary.md)
- [Repo map](../repo-map.md)
- [Documentation health audit](../maintenance/doc-health-audit.md)
- [Documentation backlog](../maintenance/backlog.md)
