> **Proposal, not live doc.** Copy this file to `supabase-selfhost-ops/AGENTS.md`. It is not read by agents where it sits now, and it is not the platform's source of truth for this repo — see [../../repo-map.md](../../repo-map.md).
> Verified against `supabase-selfhost-ops@56638b9` (2026-10-30). Re-verify before copying.

# Agent instructions for `supabase-selfhost-ops`

This repository is an Ansible-based distribution for self-hosted Supabase. The repository already ships a 341-line `AGENTS.md`. Treat this file as a concise entry point and merge it with the existing file rather than replacing it.

## What this repository owns

- Ansible roles in `roles/`: `docker`, `supabase`, `caddy`, `monitor`, `fail2ban`, `backup`, `ufw`, `luks`, `hardening`, `manifest`, `agent_access` (`AGENTS.md:26-31`).
- `install.sh` (101 lines), `migrate.sh` (895 lines), `backup.yml` (36 lines), `restore.yml` (155 lines), `restore-verify.yml` (165 lines).
- The configuration template `config.example.yml` and the rendered `env/supabase.yml` (`AGENTS.md:10-20`).

## Commands

```bash
# Install or re-run the stack
./install.sh

# On-demand full backup
ansible-playbook backup.yml

# Guardrailed PITR restore (requires target_time and confirm=yes)
ansible-playbook restore.yml -e "target_time='2026-08-01 12:30:00+00'"

# Non-destructive restore verification
ansible-playbook restore-verify.yml

# Migrate a Supabase Cloud project
./migrate.sh --config env/migrate.yml --yes
./migrate.sh --config env/migrate.yml --dry-run
```

The command forms are documented in `backup.yml:1-7`, `restore.yml:1-13`, `restore-verify.yml:1-11`, and `migrate.sh:14-20`.

## Rules

### Do not assume PITR is enabled in the Leadminer stack

The upstream `env/supabase.yml:262` ships `backup_enabled: false`. The Leadminer ops repository overwrites `playbook-supabase.yml` with the roles `supabase`, `manifest`, and `agent_access` only (`leadminer.io/.github/workflows/deploy-supabase-stack-qa.yml:228-233`). The `backup` role is not installed in the Leadminer stack. The restore scripts are available here but are not wired to a deployed Leadminer instance.

### Do not commit a rendered `env/supabase.yml`

`env/supabase.yml` is rendered by `setup.sh` from `config.yml` (`AGENTS.md:10-20`). It contains secrets. Commit `config.example.yml`, not the rendered file.

### Keep the roles idempotent

Every role is run with Ansible and is expected to be re-runnable (`README.md:1-8`). Do not write a task that appends a line to a file on every run.

## Gotchas

- The `restore.yml` playbook is destructive. It requires `target_time` and `confirm=yes`, and it takes a fresh full backup before overwriting (`restore.yml:1-13`).
- The `restore-verify.yml` playbook needs about one times the database size in extra disk space (`restore-verify.yml:7-10`).
- `migrate.sh` is read-only against the source and refuses a non-empty target (`migrate.sh:5-13`).
- The local object store is RustFS, not MinIO (`AGENTS.md:55-57`).

## Known gaps

- The deployed Leadminer configuration is applied by `sed`/heredoc mutations in the ops repository, not from this repository. The two are not identical.
- Whether the `backup` role has been tested against the Leadminer stack on a live host is not documented here.

## Related docs

- [./README.md](./README.md)
- [../../repo-map.md](../../repo-map.md)
- [../../maintenance/doc-health-audit.md](../../maintenance/doc-health-audit.md)
