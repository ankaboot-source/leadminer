> **Proposal, not live doc.** Copy this file to `urgence-palestine/AGENTS.md`. It is not read by agents where it sits now, and it is not the platform's source of truth for this repo — see [../../repo-map.md](../../repo-map.md).
> Verified against `urgence-palestine@088c62d` (2026-10-30). Re-verify before copying.

# Agent instructions for `urgence-palestine` (stub)

> Stub only. This file does not reconstruct the stack. It records what a maintainer must read before writing a real `AGENTS.md`.

## Status

- The repository has no root `AGENTS.md` today. This file is a proposal.
- The repository has a nested `traefik/AGENTS.md` (`traefik/AGENTS.md:1-38`). It covers only Mailu unbound DNSSEC trust-anchor pitfalls and host nftables plus Docker rules. It does not describe the repository purpose or the host layout.
- The repository is private and has no root `README.md`.

## What a maintainer must read before writing real instructions

1. `traefik/README.md` — the network and Nginx setup (`traefik/README.md:1-30`).
2. `traefik/AGENTS.md` — the unbound and nftables rules (`traefik/AGENTS.md:1-38`).
3. `traefik/traefik.yaml` — the static Traefik configuration and the ACME certificate resolver (`traefik/traefik.yaml:83-86`).
4. `traefik/dynamic_conf.yaml` — the routers and services (`traefik/dynamic_conf.yaml:4-158`).
5. The four `traefik/docker-compose.*.yml` files — the service definitions for Traefik, Mailu, Listmonk, and Uptime-Kuma.
6. `traefik/cert-renewal.sh` — the certificate renewal procedure.
7. Where the `risefor` application source lives. The `dynamic_conf.yaml` references a `risefor` service (`traefik/dynamic_conf.yaml:134`), but no RiseFor compose file exists in the `traefik/` directory.

## Known gaps

- The repository purpose and the host layout are not documented at the root.
- The secret handling is not documented.
- The `risefor` application source is not in this repository's `traefik/` directory.
- The relationship between `agircollectif.org` and `urgence-palestine.org` is not documented at the root.

## Related docs

- [./README.md](./README.md)
- [../../repo-map.md](../../repo-map.md)
- [../../maintenance/doc-health-audit.md](../../maintenance/doc-health-audit.md)
