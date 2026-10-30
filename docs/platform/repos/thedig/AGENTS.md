> **Proposal, not live doc.** Copy this file to `thedig/AGENTS.md`. It is not read by agents where it sits now, and it is not the platform's source of truth for this repo — see [../../repo-map.md](../../repo-map.md).
> Verified against `thedig@7d16f52` (2026-10-30). Re-verify before copying.

# Agent instructions for `thedig`

TheDig is the person and company enrichment engine for Leadminer. Read `README.md` for the architecture and the integration points. This file gives the commands and rules an agent needs before it changes the API, the MCP server, or the deployment configuration.

## What this repository owns

- The FastAPI application (`main.py`, `thedig/api/`, `thedig/excavators/`).
- The MCP server (`thedig/mcp_server.py`).
- The local development environment (`docker-compose.yml`, `default.env`, `pyproject.toml`).
- The deployment trigger workflows (`.github/workflows/deployment-trigger-prod.yml`, `.github/workflows/deployment-trigger-qa.yml`).

## How Leadminer calls this service

The Leadminer backend calls `POST {THEDIG_URL}/person/` and `POST {THEDIG_URL}/person/bulk?endpoint=...` with the `X-API-KEY` header (`backend/src/services/enrichment/thedig/client.ts:65-91`). The backend registers the engine when `THEDIG_API_KEY` and `THEDIG_URL` are set (`backend/src/services/enrichment/index.ts:42-47`).

## Commands

```bash
# Run the API with Docker
docker-compose up -d

# Run the API with uv
uv venv .venv
uv sync --frozen --extra vision
uv run patchright install chrome
uv run uvicorn main:app --reload

# Run the MCP server over stdio
uv run thedig-mcp

# Run the tests
uv run pytest
```

The API serves its OpenAPI docs at `http://localhost:8080/docs` (`README.md:76`). The Docker compose file maps `8080:8080` (`docker-compose.yml:14-15`).

## Rules

### Do not commit the TheDig `.env`

The `.env` file is generated on the server from `leadminer.io/thedig.env` on every deploy (`leadminer.io/.github/workflows/thedig-deploy-prodhost.yml:73`). The repository ships `default.env` as the template (`README.md:64-66`). Do not commit a `.env` with credentials.

### Do not add a deployment workflow in this repository

The deployment runs from `leadminer.io/.github/workflows/thedig-deploy-prodhost.yml`. This repository only sends the `repository_dispatch` event (`deployment-trigger-prod.yml:1-20`, `deployment-trigger-qa.yml:1-20`). Do not add a deploy step here.

### Keep the MCP server and the API in sync

The MCP server calls the API through `THEDIG_API_BASE_URL` (`README.md:94-97`). If you change an API route or a request shape, update `thedig/mcp_server.py` and the MCP client example in `README.md:111-126`.

## Gotchas

- The MCP server runs over stdio (`mcp_server.py:87`). It is not an HTTP server.
- The API requires Google Vision credentials. The `setup_googlecloud.sh` script creates the Google Cloud project and API key (`README.md:67-69`).
- The single TheDig instance serves both Leadminer prod and QA. A change that restarts the instance affects both environments (`leadminer.io/docs/thedig.md:1-10`).
- The bulk endpoint takes an `endpoint` query parameter (`client.ts:91`). Do not call it without the parameter.

## Known gaps

- The repository has no `AGENTS.md` or `CLAUDE.md` today. This file is a proposal.
- The `thedig` deployment uses `GOOGLE_CREDENTIALS_THEDIG` and a set of Bing, Brave, and Vertex AI secrets. The full secret list is in `leadminer.io/.github/workflows/thedig-deploy-prodhost.yml:20-28`, not in this repository.
- Whether the MCP server is used in production or only in development is not documented.

## Related docs

- [./README.md](./README.md)
- [../../repo-map.md](../../repo-map.md)
- [../../../runbooks/deploy.md](../../../runbooks/deploy.md)
