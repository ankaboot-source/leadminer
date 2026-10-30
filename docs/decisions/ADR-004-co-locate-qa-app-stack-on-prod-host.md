# ADR-004: Co-locate the QA app stack on the production host with dedicated ports

## Status

Accepted

## Date

Documented 2026-10-30; original decision date unrecovered (evidence clones are shallow).

## Context

The platform runs two application environments, prod and QA, and two Supabase environments, prod and QA. Running four separate droplets increases cost and operational surface. The reverse proxy, shared Redis and a single TheDig instance are already centralized on one host.

## Decision

The Leadminer application stack for prod and QA runs on one droplet (`vars.LEADMINER_PROD_IP`), separated by ports, compose files and environment names. QA uses `docker-compose.qa.yml`, QA-specific ports (`LEADMINER_API_PORT=8121`, `LEADMINER_FRONTEND_PORT=8182`, `EMAIL_FETCHING_SERVICE_PORT=8183`), a separate checkout (`/home/leadminer/leadminer_qa`) and a combined Caddyfile rendered by `playbook.all.yml`.

QA Supabase is not co-located; it runs on its own droplet (see [ADR-008](./ADR-008-render-supabase-stack-and-mutate-templates.md)).

Evidence anchors:

- `leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:105` — `host: ${{vars.LEADMINER_PROD_IP}}`.
- `leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:115` — `APP_REPO="/home/leadminer/leadminer_qa"`.
- `leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:136` — `ansible/caddy/leadminer/playbook.all.yml` renders the combined Caddyfile.
- `leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:190-192` — QA port exports `8121`, `8182`, `8183`.
- `leadminer.io@256a710:.github/workflows/qa-backend-build-deploy-prodhost.yml:196` — `envsubst < $CONF_REPO/docker-compose.qa.yml > $APP_REPO/docker-compose.yml`.
- `leadminer.io@256a710:docker-compose.qa.yml:48` — QA frontend image `ankabootorg/leadminer-frontend-qa:latest`.
- `leadminer.io@256a710:docs/REVERSE-PROXY.md:41-51` — public routing for prod and QA on the same host.

## Alternatives considered

- Two separate application droplets (one per environment): doubles cost and means two Caddy instances, two Redis clients and two monitoring agents.
- A single compose project with per-environment overrides: rejected because the two stacks need independent lifecycles and container names (`leadminer-api-${env}`).

## Consequences

- A host-level failure or a Docker daemon restart affects both prod and QA application stacks. The blast radius is shared even though the application ports are separate.
- The QA and prod app stacks share the external Docker network `leadminer-net` and the single shared Redis instance; they use separate logical Redis databases via `REDIS_DB_PROD` / `REDIS_DB_QA`.
- The reverse proxy renders the combined prod+QA Caddyfile. Changing one environment's routing means re-rendering and reloading the combined config.
- QA Supabase remains a separate droplet, so a QA database failure does not affect the application host.

## Related docs

- [../runbooks/incident-response.md](../runbooks/incident-response.md)
- [../platform/overview.md](../platform/overview.md)
