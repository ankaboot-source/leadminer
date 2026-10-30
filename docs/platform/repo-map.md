# Repository map

> Index of all 23 repositories in the `ankaboot-source` organization with their documentation status. Read this if you are trying to find out what a repository does, whether it is documented, or whether a drop-in documentation proposal exists for it.

## TL;DR

- There are 23 repositories in the `ankaboot-source` organization.
- `leadminer` is the application source, `leadminer.io` is the infrastructure/ops repository, and `leadminer-commercial` is the billing source overlay.
- Only 7 repositories receive drop-in documentation proposals: `leadminer.io`, `leadminer-commercial`, `thedig`, `supabase-selfhost-ops`, `email-open-data`, `imap-autoconfig`, and `urgence-palestine`.
- 16 repositories are catalogued here only; no drop-in proposal exists for them.
- `leadminer` has 10 workflows and no `docs/` directory (`docs/plans/` is gitignored and absent).
- `leadminer.io` has 24 workflows.

## Repository catalogue

| repo                        | visibility | last push  | primary language | one-line purpose                                                                  | platform role | docs present                                                        | doc health | documented here? |
| --------------------------- | ---------- | ---------- | ---------------- | --------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------- | ---------- | ---------------- |
| `.github`                   | PUBLIC     | 2023-08-13 | none             | github for ankaboot (org profile meta-repo)                                       | side          | profile only                                                        | poor       | no               |
| `boucle`                    | PUBLIC     | 2026-10-29 | Shell            | Loop engineering for builders                                                     | side          | README, AGENTS, docs/                                               | good       | no               |
| `boucle.dev`                | PUBLIC     | 2026-10-29 | Shell            | Landing page for boucle                                                           | side          | README, AGENTS                                                      | good       | no               |
| `casa-webapp-guide`         | PUBLIC     | 2025-02-24 | Shell            | Pass CASA certification like a pro                                                | side          | README, docs/                                                       | partial    | no               |
| `claude-code-proxy`         | PRIVATE    | 2026-06-01 | Python           | Use your Claude Pro subscription from any AI coding agent                         | side          | README, AGENTS                                                      | partial    | no               |
| `email-open-data`           | PUBLIC     | 2026-10-29 | none             | disposable, free and public email providers and banned email servers IP           | supporting    | README, workflow, data files                                        | partial    | yes              |
| `email-signature-extractor` | PRIVATE    | 2024-11-08 | none             | email signature extraction engine                                                 | side          | README (1 line)                                                     | poor       | no               |
| `IAM-Benchmark`             | PRIVATE    | 2021-08-02 | none             | IAM benchmark                                                                     | side          | README (1 line)                                                     | poor       | no               |
| `imap-autoconfig`           | PUBLIC     | 2025-03-28 | TypeScript       | Discover IMAP settings for an user                                                | supporting    | README, src/, tests/                                                | partial    | yes              |
| `leadminer`                 | PUBLIC     | 2026-10-28 | HTML             | Leadminer - mine, clean & enrich contacts then send campaigns from your own email | core          | README, AGENTS.md, CONTRIBUTING.md, DUAL-LICENSE.md, nested READMEs | partial    | yes              |
| `leadminer-commercial`      | PRIVATE    | 2026-10-09 | TypeScript       | billing extension for leadminer                                                   | supporting    | README                                                              | partial    | yes              |
| `leadminer.io`              | PRIVATE    | 2026-10-29 | TypeScript       | leadminer.io — SaaS version of leadminer (infra config)                           | core          | README, docs/ (14 files), data-backup, redis, terraform, thedig     | partial    | yes              |
| `leadminer.io-website`      | PRIVATE    | 2026-06-29 | Vue              | Nuxt SaaS website for leadminer.io                                                | side          | README, CLAUDE.md, AGENTS.MD                                        | partial    | no               |
| `m3llm`                     | PRIVATE    | 2026-10-29 | Python           | tunisian chat agent based on OpenWebUI and other tools                            | side          | README, AGENTS, docs/                                               | good       | no               |
| `manjaro-skill`             | PUBLIC     | 2026-06-30 | none             | Manjaro Linux system administration skill for AI coding assistants                | side          | README, SKILL.md                                                    | partial    | no               |
| `node-imap`                 | PUBLIC     | 2023-11-10 | JavaScript       | An IMAP client module for node.js                                                 | side          | README                                                              | partial    | no               |
| `opencode-thaura`           | PUBLIC     | 2026-03-28 | JavaScript       | OpenCode plugin for Thaura AI                                                     | side          | README                                                              | partial    | no               |
| `openweb-proxy`             | PUBLIC     | 2023-08-24 | Python           | Generate list of working, fast and stealth proxies                                | supporting    | README, CONTRIBUTING.rst                                            | partial    | no               |
| `pdwn`                      | PUBLIC     | 2026-05-28 | Rust             | Personal Data Watch & Neutralize (local-first desktop)                            | side          | README, AGENTS, CONTRIBUTING.md                                     | good       | no               |
| `supabase-selfhost-ops`     | PUBLIC     | 2026-10-19 | Jinja            | Self-host Supabase in production, AI-ready                                        | supporting    | README, AGENTS.md, docs/                                            | good       | yes              |
| `thedig`                    | PUBLIC     | 2026-10-24 | Python           | TheDig enrich personal data from a full name and an email                         | supporting    | README                                                              | partial    | yes              |
| `urgence-palestine`         | PRIVATE    | 2026-10-28 | Shell            | reverse-proxy / mail stack for agircollectif.org & urgence-palestine.org          | side          | `traefik/` only                                                     | poor       | stub             |
| `wikiadviser`               | PUBLIC     | 2026-10-26 | JavaScript       | Write, edit, and review articles together in real time                            | side          | README, AGENTS, docs/                                               | good       | no               |

`documented here?` means a drop-in proposal exists under `docs/platform/repos/<repo>/`. `yes` means both `README.md` and `AGENTS.md` proposals exist. `stub` means a stub-only proposal exists. `no` means no drop-in proposal is provided. `leadminer` is the repository that hosts this documentation set, so its documentation is the `docs/` tree itself rather than a drop-in.

## Maintenance-risk pattern: dormant repositories still referenced by live code or workflows

Four repositories have a last-push date older than the other repositories in the organization and are still referenced by live code, workflows, or the operating documentation. A maintainer who archives them without checking the reference will break a live path.

| repo                        | last push  | referenced by                                                                                                                                                                                                                                                                                                                                      |
| --------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openweb-proxy`             | 2023-08-24 | `leadminer.io/.github/workflows/update-proxy-list.yaml:25` clones `https://github.com/ankaboot-source/openweb-proxy`; `leadminer.io/.github/workflows/update-proxy-list.yaml:27` runs `python -m open_web_proxy`. The workflow is `workflow_dispatch` only (the scheduled trigger in `update-proxy-list.yaml:3-4` is commented out).               |
| `email-signature-extractor` | 2024-11-08 | No cross-repository reference was found in the app repository or the ops repository. The app repository has a module with a similar name, `backend/src/services/signature/llm/signature-extractor-cache.ts:6`, but it is a Redis cache wrapper and does not call the repository. The only mention of the repository name is its own `README.md:1`. |
| `imap-autoconfig`           | 2025-03-28 | Consumed as the npm package `@ankaboot.io/imap-autoconfig` by the edge functions: `supabase/functions/imap/index.ts:5` and `supabase/functions/email-campaigns/index.ts:4` import it; `supabase/functions/email-campaigns/deno.json:7` pins the dependency.                                                                                        |
| `node-imap`                 | 2023-11-10 | No cross-repository reference to `ankaboot-source/node-imap` was found. The app repository declares the npm package `imap@^0.8.19` (`backend/package.json:54`), which is not this GitHub fork. `micro-services/emails-fetcher/package.json:20` and `:41` also declare the npm `imap` package.                                                      |

`email-signature-extractor` and `node-imap` have no confirmed live consumer in the repositories examined. `openweb-proxy` and `imap-autoconfig` have live consumers.

## Known gaps

- The origin of the 13 files present in `leadminer.io/supabase/functions` and in neither source repository cannot be recovered from the shallow clone. See `three-repo-model.md` for the append-only model.
- Whether `email-signature-extractor` is deployed or consumed by any service outside the repositories examined is not documented. Its README is a single line (`README.md:1`).
- GitHub metadata (last push, visibility) was read from `gh repo list ankaboot-source`; it is not a repository file and cannot be cited by line.

## Related docs

- [./overview.md](./overview.md)
- [./three-repo-model.md](./three-repo-model.md)
- [./deployment-flow.md](./deployment-flow.md)
- [./maintenance/doc-health-audit.md](./maintenance/doc-health-audit.md)
- [./maintenance/backlog.md](./maintenance/backlog.md)
- [./repos/](./repos/)
