# Documentation health audit

> A repository-by-repository audit of documentation coverage, accuracy, and maintenance risks. It lists what documentation exists in each repository and where the documentation has drifted from the code. It is the evidence base for the backlog priorities.

## TL;DR

- Nine of the 23 repositories have a root `AGENTS.md` or `CLAUDE.md`: `boucle`, `boucle.dev`, `claude-code-proxy`, `leadminer`, `leadminer.io-website`, `m3llm`, `pdwn`, `supabase-selfhost-ops`, and `wikiadviser`.
- Six repositories have a `docs/` directory: `boucle`, `casa-webapp-guide`, `leadminer.io`, `m3llm`, `supabase-selfhost-ops`, and `wikiadviser`.
- `leadminer` has no committed `docs/` directory. The `docs/plans/` directory is gitignored and absent from the clone.
- `leadminer.io` has 13 Markdown files under `docs/` plus the `docs/schemas/` directory. `docs/DEPLOY.md` links to workflow files that do not exist in `.github/workflows/`.
- The ops stack workflow drops the upstream `backup` role and ships `backup_enabled: false`, so PITR is available in the upstream distribution but not deployed in this stack.
- `leadminer.io` has 24 workflows in `.github/workflows/`; `leadminer` has 10.
- `leadminer.io/supabase/functions/.env.dev` and `.env.prod` are git-tracked and contain credential-shaped values. The files are not read or printed during this audit; the finding is recorded by name and location only. Rotating and purging them is a security task outside documentation scope.
- Four repositories have a last-push date older than 2026: `openweb-proxy`, `node-imap`, `email-signature-extractor`, and `imap-autoconfig`. Two of them are referenced by live files; the other two have no confirmed consumer in the repositories examined.

## Repository-by-repository documentation health

### Core repositories

**`leadminer`** (PUBLIC, last push 2026-10-28)

- Documentation files: `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `DUAL-LICENSE.md`, `backend/README.md`, and `frontend/README.md`. The `micro-services/emails-fetcher/` directory has no `README.md`, and `supabase/functions/` has no `README.md`. No `docs/` directory is committed; `docs/plans/` is gitignored and absent.
- `README.md` is 182 lines. It has a `## Documentation` section at line 19 and a `## How to run locally?` section at line 47.
- `AGENTS.md` is 391 lines. Its CI/CD section is `AGENTS.md:289-314`. It references the current workflow name `qa-backend-build-deploy-prodhost.yml` at `AGENTS.md:305`.
- Workflows: `.github/workflows/` contains 10 files.

**`leadminer.io`** (PRIVATE, last push 2026-10-29)

- Documentation files: `README.md`, `docs/` with 13 Markdown files (`DEPLOY.md`, `FAIL2BAN.md`, `GOOD_RESOURCES.md`, `INTERNAL-CONNECTIVITY.md`, `MAIL-SERVER.md`, `MONITORING.md`, `oxahost-leadminer-server.md`, `PROXY-SERVER.md`, `REACHER.md`, `REVERSE-PROXY.md`, `SECURITY.md`, `SUPABASE-DEPLOY.md`, `thedig.md`) plus `docs/schemas/`. `data-backup/README.md` and `redis/README.md` exist. No `AGENTS.md`.
- `README.md` is 38 lines. At `README.md:20` the link label does not match its `/docs/REVERSE-PROXY.md` target. The target exists in `docs/`.
- `docs/DEPLOY.md` is 117 lines. Its workflow links at `docs/DEPLOY.md:20-22`, `docs/DEPLOY.md:25`, and `docs/DEPLOY.md:111` point to file names that are absent from `.github/workflows/`.
- Workflows: `.github/workflows/` contains 24 files. The QA app-deploy workflows declare `workflow_run: workflows: ["Deploy Supabase"]` at `qa-backend-build-deploy-prodhost.yml:5-6`, `qa-frontend-build-deploy-prodhost.yml:5-6`, and `qa-no-build-deploy-prodhost.yml:5-6`. No workflow in `.github/workflows/` has the name `Deploy Supabase`.
- Frontend image tags: `docker-compose.yml:48` uses `ankabootorg/leadminer-frontend:latest`; `docker-compose.qa.yml:48` uses `ankabootorg/leadminer-frontend-qa:latest`.
- Function sync: the application repository syncs functions with `rsync` and no `--delete` at `leadminer/.github/workflows/push-supabase-functions.yml:22`. The server deploy copies functions with `cp -r` at `deploy-supabase-functions-qa.yml:67`.
- The deploy-time commercial overlay is `leadminer-integration.sh` at the repository root. It copies the commercial backend and frontend with `cp -r` at `leadminer-integration.sh:59-60`.
- Git-tracked env files: `supabase/functions/.env.dev` and `supabase/functions/.env.prod` are tracked in git and contain credential-shaped values. This audit did not read their contents. The finding is recorded by name and location only. Rotating the credentials and purging the files from git history is outside documentation scope.

**`leadminer-commercial`** (PRIVATE, last push 2026-10-09)

- Documentation files: `README.md` (91 lines). No `AGENTS.md` or `CLAUDE.md`.
- README accuracy: the README describes the local-development integration method at `README.md:12-16`. It does not mention the deploy-time overlay in `leadminer-integration.sh` or the three `rsync` exclusions in `leadminer/.github/workflows/push-supabase-functions.yml:22`.
- The billing plugin is `backend/src/utils/billing-plugin/index.ts`. The billing edge function is `supabase/functions/billing/index.ts`. The repository has 6 migrations under `supabase/migrations/`.

### Supporting repositories

**`supabase-selfhost-ops`** (PUBLIC, last push 2026-10-19)

- Documentation files: `README.md` (523 lines), `AGENTS.md` (341 lines), `CONTRIBUTING.md`, and `docs/` with 2 Markdown files (`advanced-docs.md`, `connect-your-agent.md`).
- `AGENTS.md` covers the repository purpose, the key files, and the Ansible roles at `AGENTS.md:1-70`.
- The repository ships `install.sh`, `migrate.sh`, `backup.yml`, `restore.yml`, and `restore-verify.yml`. The `roles/` directory contains `agent_access`, `backup`, `caddy`, `docker`, `fail2ban`, `hardening`, `luks`, `manifest`, `monitor`, and `supabase`.
- `env/supabase.yml:262` sets `backup_enabled: false`.
- The Leadminer ops stack workflow overwrites `playbook-supabase.yml` with the roles `supabase`, `manifest`, and `agent_access` at `leadminer.io/.github/workflows/deploy-supabase-stack-qa.yml:228-234`. The `backup` role is not installed.

**`thedig`** (PUBLIC, last push 2026-10-24)

- Documentation files: `README.md` (144 lines). No `AGENTS.md` or `CLAUDE.md`. Workflows: `.github/workflows/deployment-trigger-prod.yml` and `.github/workflows/deployment-trigger-qa.yml`.
- The API entrypoint is `main.py`. The MCP server is `thedig/mcp_server.py`.
- `README.md` describes the enrichment behavior at `README.md:9` and the `#OptOut` rule at `README.md:20`. It documents the API docs URL at `README.md:76` and the MCP server at `README.md:89`.
- The app repository calls the service at `backend/src/services/enrichment/thedig/client.ts:65` (`baseURL`), `:67` (`X-API-KEY`), `:76` (`POST /person/`), and `:91` (`POST /person/bulk`).

**`email-open-data`** (PUBLIC, last push 2026-10-29)

- Documentation files: `README.md` (27 lines) and the data files `disposable-email-domains.json`, `disposable-email-domains.txt`, `free-email-domains.json`, `free-email-domains.txt`, `ISP-domains.json`, `ISP-domains.txt`, `public-email-providers.json`, `public-email-providers.txt`, `mailserver-banned-ips.json`, and `mailserver-banned-ips.txt`.
- The refresh workflow is `.github/workflows/fetch-new-data.yaml` (73 lines). Its schedule is `0 0 * * *` at `fetch-new-data.yaml:4`, which is daily at midnight.
- `README.md:16` says "Files are updated hourly." The workflow schedule is daily. The README is inconsistent with the workflow.
- Consumers: `backend/src/fetchProviders.ts:10` and `:13` read the disposable and public lists. `leadminer.io/blacklist-checker.sh:11` reads the banned-IP list, and `:16` checks an IP against it.
- No `AGENTS.md`.

**`imap-autoconfig`** (PUBLIC, last push 2025-03-28)

- Documentation files: `README.md`, `src/`, `tests/`, `package.json`.
- `package.json:2` names the package `@ankaboot.io/imap-autoconfig`; `package.json:4` sets the version to `0.2.0`.
- `README.md:16` shows the import as `imap-autoconfig`, which does not match the package name.
- The edge functions import the package at `supabase/functions/imap/index.ts:5` and `supabase/functions/email-campaigns/index.ts:4`.
- No `AGENTS.md`.

### Side and dormant repositories

**`urgence-palestine`** (PRIVATE, last push 2026-10-28)

- Documentation files: the repository root contains only `traefik/`. There is no root `README.md` and no root `AGENTS.md`.
- `traefik/` contains `README.md`, `AGENTS.md`, `cert-renewal.sh`, `docker-compose.kuma.yml`, `docker-compose.listmonk.yml`, `docker-compose.mailu.yml`, `docker-compose.traefik.yml`, `dynamic_conf.yaml`, and `traefik.yaml`. There is no RiseFor compose file in `traefik/`.
- `traefik/README.md:1` is titled "Reverse Proxying Multiple Services on the Same Port with Traefik". It describes Mailu and a host-based application at `traefik/README.md:2-4`.
- `traefik/dynamic_conf.yaml` routes `agir.urgence-palestine.org` at `:4`, `agircollectif.org` at `:14` and `:26`, `urgence-palestine.org` at `:41`, `listmonk.leadminer.io` at `:47`, `uptime.agircollectif.org` at `:55`, and the `mta-sts` hosts at `:63`.

**`boucle`, `boucle.dev`, `casa-webapp-guide`, `claude-code-proxy`, `email-signature-extractor`, `IAM-Benchmark`, `leadminer.io-website`, `m3llm`, `manjaro-skill`, `node-imap`, `opencode-thaura`, `openweb-proxy`, `pdwn`, `wikiadviser`, `.github`**

- Documentation files: these repositories have READMEs of varying quality. `email-signature-extractor` and `IAM-Benchmark` have single-line READMEs. `wikiadviser`, `m3llm`, `boucle`, `pdwn`, and `supabase-selfhost-ops` have a root `AGENTS.md` or a `docs/` directory.
- README accuracy: spot checks are not performed for these repositories in this audit because they are outside the platform's core and supporting set. The `repo-map.md` records their documentation status.
- `openweb-proxy` is referenced by `leadminer.io/.github/workflows/update-proxy-list.yaml:25`, which clones `https://github.com/ankaboot-source/openweb-proxy`.
- No consumer of `node-imap` or `email-signature-extractor` exists in the application repository or the operations repository.

## Re-verification procedure

Run the following commands from the platform root. Set `WORKSPACE` to the parent directory that contains the clones. The procedure verifies the repository count, the workflow counts, the documentation inventory, and the key drift points.

```bash
# 1. Repository count and metadata
gh repo list ankaboot-source --limit 100 --json name,visibility,pushedAt,primaryLanguage

# 2. Workflow counts
gh api repos/ankaboot-source/leadminer/actions/workflows --jq '.total_count'
gh api repos/ankaboot-source/leadminer.io/actions/workflows --jq '.total_count'

# 3. Documentation file inventory (after cloning the repositories to $WORKSPACE)
for repo in leadminer leadminer.io leadminer-commercial thedig supabase-selfhost-ops email-open-data imap-autoconfig urgence-palestine; do
  echo "=== $repo ==="
  find "$WORKSPACE/$repo" -maxdepth 2 \( -iname 'README.md' -o -iname 'AGENTS.md' -o -iname 'CLAUDE.md' \) -not -path '*/.git/*'
done

# 4. Drift checks
rg -n 'REVERSE-PROXY\.md' "$WORKSPACE/leadminer.io/README.md"
rg -n 'actions/workflows/' "$WORKSPACE/leadminer.io/docs/DEPLOY.md"
rg -n 'workflow_run' "$WORKSPACE/leadminer.io/.github/workflows"
rg -n 'cp -r' "$WORKSPACE/leadminer.io/leadminer-integration.sh"
rg -n 'rsync' "$WORKSPACE/leadminer/.github/workflows/push-supabase-functions.yml"
rg -n 'playbook-supabase.yml' "$WORKSPACE/leadminer.io/.github/workflows/deploy-supabase-stack-qa.yml"
rg -n 'backup_enabled' "$WORKSPACE/supabase-selfhost-ops/env/supabase.yml"
git -C "$WORKSPACE/leadminer.io" ls-files 'supabase/functions/.env.*'
```

The `gh api` commands require the `gh` CLI to be authenticated. The `find` command reports the documentation files in each cloned repository. The `rg` commands check the documented paths against the real files. The `git ls-files` command lists the git-tracked env files without reading their contents.

## Known gaps

- The README accuracy for the 14 side repositories is not spot-checked in this audit. The `repo-map.md` records their documentation status but not their accuracy.
- The last-push dates and visibility are read from `gh repo list` and cannot be cited by repository file line.
- The git-tracked env file finding is reported by name and location only. The audit did not read the files. The credential rotation and git-history purge are outside documentation scope.
- The origin of the 13 files present in `leadminer.io/supabase/functions` and in neither source repository cannot be recovered from the shallow clone. See `three-repo-model.md`.

## Related docs

- [../repo-map.md](../repo-map.md)
- [../overview.md](../overview.md)
- [../three-repo-model.md](../three-repo-model.md)
- [../deployment-flow.md](../deployment-flow.md)
- [./backlog.md](./backlog.md)
- [../repos/leadminer.io/AGENTS.md](../repos/leadminer.io/AGENTS.md)
- [../repos/supabase-selfhost-ops/AGENTS.md](../repos/supabase-selfhost-ops/AGENTS.md)
