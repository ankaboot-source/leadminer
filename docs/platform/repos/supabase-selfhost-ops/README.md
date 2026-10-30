> **Proposal, not live doc.** Copy this file to `supabase-selfhost-ops/README.md`. It is not read by agents where it sits now, and it is not the platform's source of truth for this repo — see [../../repo-map.md](../../repo-map.md).
> Verified against `supabase-selfhost-ops@56638b9` (2026-10-30). Re-verify before copying.

# Supabase Self-Host Ops

> The Supabase distribution used to render the Leadminer database stack. Read this if you are trying to understand what this repository owns, how the Leadminer ops repository consumes it, or why PITR is available here but not enabled in the deployed Leadminer stack.

## TL;DR

- This repository is an Ansible-based distribution for self-hosted Supabase (`README.md:1-8`).
- It owns the templates, `install.sh`, `migrate.sh` (895 lines), `backup.yml`, `restore.yml`, `restore-verify.yml`, and the Ansible roles including `backup` (`roles/`).
- The Leadminer ops repository clones it, mutates its templates on the server, and runs `install.sh` (`leadminer.io/.github/workflows/deploy-supabase-stack-qa.yml:110-233`).
- The ops stack workflow **drops the `backup` role**. The deployed Leadminer stack ships `backup_enabled: false` (`env/supabase.yml:262`). PITR is available upstream but not deployed in the Leadminer stack.
- The repository already ships an `AGENTS.md` (341 lines). The `AGENTS.md` next to this file is a concise proposal.

## What this repository owns

| Component                | Path                                     | What it does                                                                                                                 |
| ------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Ansible roles            | `roles/`                                 | `docker`, `supabase`, `caddy`, `monitor`, `fail2ban`, `backup`, `ufw`, `luks`, `hardening`, `manifest`, `agent_access`.      |
| Installer                | `install.sh`                             | Bootstraps Ansible and runs the selected playbook (`install.sh:1-101`).                                                      |
| Migration tool           | `migrate.sh`                             | Migrates a Supabase Cloud project into a self-hosted instance (`migrate.sh:1-895`).                                          |
| On-demand backup         | `backup.yml`                             | Runs a full pgBackRest backup (`backup.yml:1-36`).                                                                           |
| Guardrailed PITR restore | `restore.yml`                            | Refuses to run without `target_time`, requires `confirm=yes`, takes a fresh backup before overwriting (`restore.yml:1-155`). |
| Restore verification     | `restore-verify.yml`                     | Restores into a throwaway volume and runs healthchecks without touching prod PGDATA (`restore-verify.yml:1-165`).            |
| Config template          | `config.example.yml`, `env/supabase.yml` | The single source of truth for the rendered stack configuration (`AGENTS.md:10-20`).                                         |

The `backup` role implements pgBackRest, continuous WAL archiving, full and differential backups, encryption, and Grafana alerts (`AGENTS.md:55-57`).

## How the Leadminer ops repository consumes it

The Leadminer ops repository does not run this repository as a library. It clones this repository on the server, mutates the templates in place, and runs `install.sh` (`leadminer.io/.github/workflows/deploy-supabase-stack-qa.yml:110-233`):

1. It clones `ankaboot-source/supabase-selfhost-ops` and runs `git reset --hard origin/main` (`deploy-supabase-stack-qa.yml:110-117`).
2. It renders `env/supabase.yml` with the public domain and injected secrets (`deploy-supabase-stack-qa.yml:120-169`).
3. It rewrites PostgREST, mailer template, Postgres tuning, and data-volume settings with `sed` and heredocs (`deploy-supabase-stack-qa.yml:175-226`).
4. It overwrites `playbook-supabase.yml` with the roles `supabase`, `manifest`, and `agent_access` (`deploy-supabase-stack-qa.yml:228-233`).
5. It runs `install.sh` (`deploy-supabase-stack-qa.yml:236`).

The mutations are not committed. The deployed configuration exists only on the server.

## The `backup` role is not deployed

The upstream `env/supabase.yml:262` ships `backup_enabled: false`. The ops stack workflow overwrites the playbook to use only `supabase`, `manifest`, and `agent_access` (`leadminer.io/.github/workflows/deploy-supabase-stack-qa.yml:228-233`). The `backup` role is dropped.

The consequence: PITR, WAL archiving, and the guardrailed `restore.yml` are available in this repository but are not installed in the Leadminer stack. The only backup in place for Leadminer is the logical dump in `leadminer.io/data-backup/` (`leadminer.io/data-backup/README.md:88-132`). Enabling the upstream `backup` role is a backlog item (`docs/platform/maintenance/backlog.md`).

## Known gaps

- The deployed configuration is applied by `sed` and heredoc mutations in the ops repository. It is not committed here or there.
- The `backup` role is not deployed. Whether it has been tested against the Leadminer stack on a live host is not documented.
- The `migrate.sh` procedure is 895 lines and the README does not summarize its preconditions or its failure modes.

## Related docs

- [./AGENTS.md](./AGENTS.md)
- [../../repo-map.md](../../repo-map.md)
- [../../maintenance/doc-health-audit.md](../../maintenance/doc-health-audit.md)
- [../../maintenance/backlog.md](../../maintenance/backlog.md)
- [../../../runbooks/supabase-operations.md](../../../runbooks/supabase-operations.md)
