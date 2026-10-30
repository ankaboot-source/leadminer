> **Proposal, not live doc.** Copy this file to `thedig/README.md`. It is not read by agents where it sits now, and it is not the platform's source of truth for this repo — see [../../repo-map.md](../../repo-map.md).
> Verified against `thedig@7d16f52` (2026-10-30). Re-verify before copying.

# TheDig

> The enrichment engine for Leadminer. Read this if you are trying to understand how Leadminer calls TheDig, how TheDig is deployed, or how to use the MCP server.

## TL;DR

- TheDig enriches personal data from a full name and an email address using OSINT and AI (`README.md:9`).
- Leadminer calls TheDig through `backend/src/services/enrichment/thedig/client.ts:65-91`.
- A single TheDig instance serves both Leadminer prod and QA. It is deployed by `leadminer.io/.github/workflows/thedig-deploy-prodhost.yml`.
- The MCP server is in `thedig/mcp_server.py`. It exposes the `enrich_person_email` tool over stdio (`thedig/mcp_server.py:14,81,87`).
- The ops runbook is `leadminer.io/docs/thedig.md`.

## Purpose

TheDig excavates public person and company data from an email address and a full name (`README.md:9`). It checks that the excavated data belongs to the person before returning results. A person with the `#OptOut` tag in their social profile is not enriched (`README.md:20`).

## How Leadminer calls TheDig

The Leadminer backend registers TheDig as an enrichment engine when `THEDIG_API_KEY` and `THEDIG_URL` are set (`backend/src/services/enrichment/index.ts:42-47`). The engine name is `thedig` (`backend/src/services/enrichment/thedig/index.ts:13`).

The client is in `backend/src/services/enrichment/thedig/client.ts`:

- It creates an Axios instance with `baseURL: url` (`client.ts:65`).
- It sends the API token in the `X-API-KEY` header (`client.ts:67`).
- It calls `POST /person/` for a single person (`client.ts:76`).
- It calls `POST /person/bulk?endpoint=${webhook}` for a bulk enrichment (`client.ts:91`).

The environment variables are `THEDIG_URL` and `THEDIG_API_KEY`. They are read by the backend config (`backend/src/services/enrichment/index.ts:42-47`).

## How TheDig is deployed

A single TheDig instance serves both prod and QA. The deployment is in `leadminer.io/.github/workflows/thedig-deploy-prodhost.yml`:

1. The workflow listens to `repository_dispatch` events `trigger-prod-thedig` and `trigger-qa-thedig`, and to `workflow_dispatch` (`thedig-deploy-prodhost.yml:9-12`).
2. It SSHs to the prod host at `vars.LEADMINER_PROD_IP` (`thedig-deploy-prodhost.yml:31`).
3. It clones or resets the `thedig` repository at `/home/leadminer/thedig` (`thedig-deploy-prodhost.yml:51-57`).
4. It renders the combined Caddy configuration (`thedig-deploy-prodhost.yml:59-61`).
5. It generates `thedig/.env` from `leadminer.io/thedig.env` with `envsubst` (`thedig-deploy-prodhost.yml:73`).
6. It writes the Google credentials file (`thedig-deploy-prodhost.yml:74`).
7. It builds and starts the container: `docker compose build --no-cache thedig` and `docker compose --env-file .env up -d` (`thedig-deploy-prodhost.yml:77-78`).

The TheDig `.env` is not committed in the `thedig` repository. It is regenerated on the server on every deploy from `leadminer.io/thedig.env`.

## MCP server

The MCP server is in `thedig/mcp_server.py`. It uses `FastMCP` (`mcp_server.py:14`) and exposes the tool `enrich_person_email` (`mcp_server.py:81`). It runs over stdio (`mcp_server.py:87`).

The README documents the MCP client configuration and the required environment variables (`THEDIG_API_BASE_URL`, `THEDIG_API_KEY`, `THEDIG_API_KEY_HEADER`) at `README.md:89-126`.

## Ops runbook

The operational runbook is `leadminer.io/docs/thedig.md`. It covers the architecture (single instance for prod and QA, port 8080, the separate Redis instance, the Caddy route `https://thedig-qa.leadminer.io`), the deployment procedure, and the trigger flow (`leadminer.io/docs/thedig.md:1-59`).

## Known gaps

- The README does not document the MCP server's environment variables or the stdio transport. That content is in `README.md:89-126` but not linked from the top-level usage section.
- The `thedig` repository has no `AGENTS.md` or `CLAUDE.md`.
- The exact set of Google API credentials required is documented in `default.env` and `README.md:63-76`, not in a single reference page.

## Related docs

- [./AGENTS.md](./AGENTS.md)
- [../../repo-map.md](../../repo-map.md)
- [../../overview.md](../../overview.md)
- [../../maintenance/doc-health-audit.md](../../maintenance/doc-health-audit.md)
