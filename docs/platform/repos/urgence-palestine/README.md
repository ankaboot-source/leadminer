> **Proposal, not live doc.** Copy this file to `urgence-palestine/README.md`. It is not read by agents where it sits now, and it is not the platform's source of truth for this repo — see [../../repo-map.md](../../repo-map.md).
> Verified against `urgence-palestine@088c62d` (2026-10-30). Re-verify before copying.

# urgence-palestine (stub)

> Stub documentation for a private reverse-proxy and mail stack. Read this only to learn what the repository contains and which files a maintainer must read before writing a real `AGENTS.md`.

## Status

- The repository is private.
- The repository has no root `README.md` and no root `AGENTS.md`.
- The only documentation is inside `traefik/`: `traefik/README.md` and `traefik/AGENTS.md`.
- This file is a stub. It does not reconstruct the stack from a one-line description.

## What is actually in the repository

The repository root contains only the `traefik/` directory. That directory contains:

| File                                  | Content                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `traefik/README.md`                   | A guide titled "Reverse Proxying Multiple Services on the Same Port with Traefik" (`traefik/README.md:1`). It describes a Mailu email suite and a host-based application exposed through Nginx (`traefik/README.md:2-4`).                                                                                                                                                                                      |
| `traefik/AGENTS.md`                   | Nested agent instructions. It covers Mailu unbound DNSSEC trust-anchor pitfalls and host nftables plus Docker rules (`traefik/AGENTS.md:1-38`).                                                                                                                                                                                                                                                                |
| `traefik/docker-compose.traefik.yml`  | The Traefik container (`traefik/docker-compose.traefik.yml:3`).                                                                                                                                                                                                                                                                                                                                                |
| `traefik/docker-compose.mailu.yml`    | The Mailu services: redis, nginx, unbound, admin, dovecot, postfix, oletools, rspamd, and webmail (`traefik/docker-compose.mailu.yml:8-171`).                                                                                                                                                                                                                                                                  |
| `traefik/docker-compose.kuma.yml`     | The Uptime-Kuma container (`traefik/docker-compose.kuma.yml:3`).                                                                                                                                                                                                                                                                                                                                               |
| `traefik/docker-compose.listmonk.yml` | The Listmonk application and a Postgres database (`traefik/docker-compose.listmonk.yml:9-45`).                                                                                                                                                                                                                                                                                                                 |
| `traefik/traefik.yaml`                | The Traefik static configuration. It defines the ACME certificate resolver with the email `tech@agircollectif.org` (`traefik/traefik.yaml:83-86`).                                                                                                                                                                                                                                                             |
| `traefik/dynamic_conf.yaml`           | The Traefik dynamic configuration. It routes `agir.urgence-palestine.org` (`traefik/dynamic_conf.yaml:4`), `agircollectif.org` (`traefik/dynamic_conf.yaml:14,26`), `urgence-palestine.org` (`traefik/dynamic_conf.yaml:41`), `listmonk.leadminer.io` (`traefik/dynamic_conf.yaml:47`), `uptime.agircollectif.org` (`traefik/dynamic_conf.yaml:55`), and the `mta-sts` hosts (`traefik/dynamic_conf.yaml:63`). |
| `traefik/cert-renewal.sh`             | A certificate renewal script.                                                                                                                                                                                                                                                                                                                                                                                  |

The `dynamic_conf.yaml` defines the services `risefor`, `urgence-palestine`, `listmonk`, `uptime-kuma`, and `mta-sts-service` (`traefik/dynamic_conf.yaml:134-158`).

## Known gaps

A maintainer must read the following before a real `AGENTS.md` is possible:

1. `traefik/README.md` for the network and Nginx setup.
2. `traefik/AGENTS.md` for the unbound and nftables rules.
3. `traefik/traefik.yaml` and `traefik/dynamic_conf.yaml` for the routing and the certificate resolver.
4. The four `traefik/docker-compose.*.yml` files for the service definitions.
5. Where the `risefor` application source lives. The `dynamic_conf.yaml` references a `risefor` service (`traefik/dynamic_conf.yaml:134`), but no RiseFor compose file exists in the `traefik/` directory.

There is no root `README.md` that explains the repository purpose, the host layout, or the secret handling. That file must be written by the repository owner.

## Related docs

- [./AGENTS.md](./AGENTS.md)
- [../../repo-map.md](../../repo-map.md)
- [../../maintenance/doc-health-audit.md](../../maintenance/doc-health-audit.md)
