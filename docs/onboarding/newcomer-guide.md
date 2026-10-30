# Newcomer guide

> Audience: a new maintainer with no prior Leadminer context. Time budget: 60–90 minutes to a running local stack and a passing backend test suite.

## TL;DR

- Install Node 24+, Bun 1.1+, Docker, and Deno.
- Run `npm run install-deps`, then `npm run dev:generate-env`.
- Start Supabase with `npm run dev:supabase` and Redis with `docker-compose -f docker-compose.dev.yml up -d`.
- Start the whole stack with `npm run dev:all`. The frontend is at `http://localhost:8082`.
- Run the backend unit tests with `cd backend && npm run test:unit`.

## Before you start

You need these tools:

- Node.js >= 24.0.0. Declared in `backend/package.json:125-127` and `frontend/package.json:75-77`, and pinned by `.nvmrc`.
- Bun >= 1.1.0. Declared in `micro-services/emails-fetcher/package.json:89-91`.
- Docker. Required for local Supabase and for the Redis container (`README.md:110`).
- Deno. Required to serve and test Supabase Edge Functions (`package.json:15`, `supabase/functions/email-campaigns/deno.json`).

Check Docker is running before you continue. If it is not, `supabase start` and `docker-compose` will fail.

## 1. Clone and install dependencies

```bash
git clone https://github.com/ankaboot-source/leadminer
cd leadminer
npm run install-deps
```

`install-deps` installs the root, backend, frontend, and both micro-services dependencies (`package.json:7-11`). The emails-fetcher and SMS mock use `bun install`; the rest use `npm`.

## 2. Generate environment files

```bash
npm run dev:generate-env
```

This copies each service's `.env.dev` to `.env`. If a `.env.dev` is missing, the script falls back to `.env.example`. It covers `frontend`, `backend`, `micro-services/emails-fetcher`, `micro-services/sms-gateway-mock`, and `supabase/functions` (`generate_env.sh:22-28,43-51`).

Confirm the script finishes without printing a missing-template error.

## 3. Start Supabase locally

```bash
npm run dev:supabase
```

This runs `supabase start` (`package.json:14`). It uses the local Supabase CLI configuration in `supabase/config.toml`. The local API gateway listens on port 54321 (`supabase/config.toml:10`).

Keep this terminal open while you develop.

## 4. Start Redis

```bash
docker-compose -f docker-compose.dev.yml up -d
```

This starts Redis on port 6379 and, for local development, OpenWA and the SMS gateway mock (`docker-compose.dev.yml:1-33`).

If the backend cannot reach Redis, set `REDIS_HOST` in `backend/.env` to the correct host (`README.md:107`).

## 5. Start the application stack

```bash
npm run dev:all
```

This runs `./run.sh`, which starts the API, the message worker, the email-verification worker, the signature worker, the mock external-services server, the emails-fetcher microservice, the SMS gateway mock, the Supabase functions, and the frontend (`run.sh:1-10`, `package.json:12`).

The runner starts each process in the background and waits. If one process exits, the others keep running. Check the terminal output for the first error.

### Ports

| Service              | Local URL                | Source                                                                    |
| -------------------- | ------------------------ | ------------------------------------------------------------------------- |
| Frontend             | `http://localhost:8082`  | `frontend/nuxt.config.ts:31-32`                                           |
| Backend API          | `http://localhost:8081`  | `backend/.env.dev:5`                                                      |
| Emails fetcher       | `http://localhost:8084`  | `micro-services/emails-fetcher/.env.dev:2`                                |
| SMS gateway mock     | `http://localhost:8085`  | `micro-services/sms-gateway-mock/.env.dev:2`, `docker-compose.dev.yml:30` |
| Supabase API gateway | `http://127.0.0.1:54321` | `supabase/config.toml:10`                                                 |

Open `http://localhost:8082` to confirm the frontend is up.

## 6. Run the test suites

Run each suite from its own directory.

### Backend

```bash
cd backend
npm run test:unit
```

This runs the Jest unit tests under `backend/test/unit` (`backend/package.json:7`). Integration tests use `npm run test:integration` (`backend/package.json:8`).

### Frontend

```bash
cd frontend
npm run test
```

This starts Vitest (`frontend/package.json:9`). To run once and exit, pass `--run`:

```bash
npm run test -- --run
```

### Emails fetcher microservice

```bash
cd micro-services/emails-fetcher
npm run test:unit
```

This runs the Jest unit tests under `micro-services/emails-fetcher/test/unit` (`micro-services/emails-fetcher/package.json:11`).

### SMS gateway mock

```bash
cd micro-services/sms-gateway-mock
npm run test:unit
```

This runs the Jest unit tests for the mock service (`micro-services/sms-gateway-mock/package.json:12`).

Edge-function tests are colocated with the functions (for example `supabase/functions/email-campaigns/http.test.ts`). The repo does not define a root script or a CI job that runs them. See Known gaps.

## Checklist

- [ ] Node, Bun, Docker, and Deno are installed.
- [ ] `npm run install-deps` finishes.
- [ ] `npm run dev:generate-env` finishes without a missing-template error.
- [ ] `npm run dev:supabase` is running.
- [ ] `docker-compose -f docker-compose.dev.yml up -d` is running.
- [ ] `npm run dev:all` starts without a port conflict.
- [ ] `http://localhost:8082` responds.
- [ ] `cd backend && npm run test:unit` passes.
- [ ] `cd frontend && npm run test -- --run` passes.
- [ ] `cd micro-services/emails-fetcher && npm run test:unit` passes.

## Troubleshooting

| Symptom                                       | Cause                                                   | Action                                                                                |
| --------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `supabase start` fails immediately            | Docker is not running                                   | Start Docker and retry                                                                |
| Frontend cannot reach the API                 | `SERVER_ENDPOINT` in `frontend/.env` is wrong           | Set it to `http://localhost:8081` and restart `npm run dev:all`                       |
| Backend cannot reach Redis                    | `REDIS_HOST` points at the wrong host                   | Update `REDIS_HOST` in `backend/.env` (`README.md:107`)                               |
| Port 8082 or 8081 already in use              | Another process owns the port                           | Stop the other process or change the port in the relevant `.env` and `nuxt.config.ts` |
| `npm run dev:all` exits without a clear error | One background process failed and the terminal scrolled | Run the failing service alone with its `dev:*` script                                 |
| Edge-function changes do not appear           | `supabase functions serve` was not restarted            | Restart `npm run dev:supabase-functions`                                              |

## Known gaps

- `run.sh` does not start the PostgreSQL import worker (`dev:postgresql-worker`). Start it separately when you need it: `npm run dev:backend-postgresql-worker` (`run.sh:1-10`, `backend/package.json:15`, `package.json:21`).
- `backend/README.md` and `frontend/README.md` are one-line stubs. This guide and the root `README.md` are the working source.
- `frontend/.env.dev` does not exist. `generate_env.sh` falls back to `frontend/.env.example` (`generate_env.sh:43-45`).
- CI does not run the frontend test suite: the step is commented out in `ci.yml:47-48` and `ci-pr.yml:106-107`.
- The repo defines no root command or CI job for edge-function tests. The test files exist but there is no agreed runner.
- The repository has no `docs/` directory in the current tree. This document set creates it.

## Where to get help

- Open an issue at `https://github.com/ankaboot-source/leadminer/issues` (`README.md:172`).
- Check the root `README.md` for the original quick-start and third-party service setup.
- For agent-assisted work, read [the agentic workflow](../platform/agents/agentic-workflow.md) and [repo agent guidelines](../platform/agents/repo-agent-guidelines.md).

## Related docs

- [First week](./first-week.md)
- [Glossary](../platform/glossary.md)
- [Local development](../platform/local-development.md)
- [Platform overview](../platform/overview.md)
- [Troubleshooting](../runbooks/troubleshooting.md)
- [Secrets and environment](../runbooks/secrets-and-env.md)
