# Local development

> Set up and run the Leadminer stack from zero on a single machine. Read this if you are trying to get a working local environment, start one service in isolation, or diagnose a local startup failure.

## TL;DR

- Install Node.js >= 24.0.0 and Bun >= 1.1.0 before installing dependencies.
- Run `npm run install-deps`, then `npm run dev:generate-env`.
- Start local Supabase with `npm run dev:supabase`, and Redis with `docker-compose -f docker-compose.dev.yml up -d`.
- Start the full stack with `npm run dev:all`; the frontend is at `http://localhost:8082`.
- For the guided newcomer path, use the [Newcomer guide](../onboarding/newcomer-guide.md) instead of this reference.

## Prerequisites

| Tool                      | Version                                            | Evidence                                                                                                 |
| ------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Node.js                   | >= 24.0.0                                          | `backend/package.json:125-126`, `frontend/package.json:75-76`                                            |
| Bun                       | >= 1.1.0                                           | `micro-services/emails-fetcher/package.json:89-90`, `micro-services/sms-gateway-mock/package.json:60-61` |
| Docker and Docker Compose | Current release                                    | Required for local Supabase and the Redis container (`README.md:110`)                                    |
| Supabase CLI              | Installed as a dev dependency (`supabase@^2.88.0`) | `package.json:37`                                                                                        |

Check that Docker is running before you start. `npm run dev:supabase` and `docker-compose` fail if the daemon is not available.

## 1. Clone and install

```bash
git clone https://github.com/ankaboot-source/leadminer
cd leadminer
npm run install-deps
```

`install-deps` installs the root, backend, frontend, emails-fetcher, and SMS mock dependencies. The two micro-services use `bun install`; the rest use `npm` (`package.json:7-11`).

## 2. Generate environment files

```bash
npm run dev:generate-env
```

The script copies each service's `.env.dev` to `.env` and falls back to `.env.example` when `.env.dev` is absent. It covers `frontend`, `backend`, `micro-services/emails-fetcher`, `micro-services/sms-gateway-mock`, and `supabase/functions` (`generate_env.sh:22-28,43-51`). The script exits with status 1 if a template is missing (`generate_env.sh:57-62`).

## 3. Start local Supabase

```bash
npm run dev:supabase
```

This runs `supabase start` (`package.json:14`) with the configuration in `supabase/config.toml`. The local endpoints are listed in the ports table below.

## 4. Start Redis

```bash
docker-compose -f docker-compose.dev.yml up -d
```

The compose file starts Redis on port 6379 and also starts the OpenWA container and the SMS gateway mock (`docker-compose.dev.yml:1-33`). If you already run Redis on the host, you can skip this step; adjust `REDIS_HOST` in `backend/.env` if the container hostname does not resolve (`README.md:105-107`).

## 5. Start the services

Start the full stack:

```bash
npm run dev:all
```

`dev:all` runs `./run.sh`, which starts the backend API, message worker, email verification worker, signature worker, mock external services, emails-fetcher, SMS gateway mock, Supabase functions, and frontend (`run.sh:1-10`).

Start one service at a time when you are debugging:

| Command                                       | Starts                      | Evidence          |
| --------------------------------------------- | --------------------------- | ----------------- |
| `npm run dev:backend-api`                     | Backend API                 | `package.json:17` |
| `npm run dev:backend-worker`                  | Contact extraction worker   | `package.json:18` |
| `npm run dev:backend-email-worker`            | Email verification worker   | `package.json:19` |
| `npm run dev:backend-email-signature-worker`  | Signature worker            | `package.json:20` |
| `npm run dev:backend-postgresql-worker`       | PostgreSQL import worker    | `package.json:21` |
| `npm run dev:backend-mock-external-services`  | Mock enrichment server      | `package.json:22` |
| `npm run dev:micro-services-emails-fetcher`   | Email fetcher micro-service | `package.json:23` |
| `npm run dev:micro-services-sms-gateway-mock` | SMS gateway mock            | `package.json:24` |
| `npm run dev:supabase-functions`              | Supabase edge functions     | `package.json:15` |
| `npm run dev:frontend`                        | Frontend dev server         | `package.json:16` |

The PostgreSQL import worker is not started by `run.sh`; start it explicitly with `npm run dev:backend-postgresql-worker` (`package.json:21`).

## Ports

| Service                     | Local port | Evidence                                                                  |
| --------------------------- | ---------- | ------------------------------------------------------------------------- |
| Frontend                    | 8082       | `frontend/nuxt.config.ts:29-33`, `README.md:160`                          |
| Backend API                 | 8081       | `backend/.env.dev:5`                                                      |
| Email fetcher micro-service | 8084       | `micro-services/emails-fetcher/.env.dev:2`                                |
| SMS gateway mock            | 8085       | `micro-services/sms-gateway-mock/.env.dev:2`, `docker-compose.dev.yml:30` |
| Redis                       | 6379       | `backend/.env.dev:40`, `docker-compose.dev.yml:5`                         |
| OpenWA gateway              | 2785       | `docker-compose.dev.yml:10,14`                                            |
| OpenWA dashboard            | 2886       | `docker-compose.dev.yml:11,15`                                            |
| Supabase API                | 54321      | `supabase/config.toml:7-10`                                               |
| Supabase database           | 54322      | `supabase/config.toml:24-26`                                              |
| Supabase Studio             | 54323      | `supabase/config.toml:67-70`                                              |
| Supabase Inbucket           | 54324      | `supabase/config.toml:78-81`                                              |

## Run tests

```bash
cd backend && npm run test:unit
cd backend && npm run test:integration
cd frontend && npm run test -- --run
cd micro-services/emails-fetcher && npm run test:unit
```

The backend uses Jest for unit and integration tests (`backend/package.json:7-8`). The frontend uses Vitest; `-- --run` runs once instead of watch mode (`frontend/package.json:9`). The emails-fetcher uses Jest (`micro-services/emails-fetcher/package.json:11`).

## Mock services

- The backend mock external-services server is `backend/src/mocks/enrichment/server.ts`, started with `npm run dev:mock-external-services` (`backend/package.json:11`).
- The SMS gateway mock is `micro-services/sms-gateway-mock/src/server.ts`, started with `npm run dev:micro-services-sms-gateway-mock` (`package.json:24`). It is dev-only and refuses to serve in production (`docker-compose.yml:33-39`).
- The dev compose overlay starts OpenWA and the SMS mock with `NODE_ENV=development` (`docker-compose.dev.yml:7-33`).

## Troubleshooting

| Symptom                                   | Cause                                                               | Action                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev:generate-env` exits non-zero | One or more `.env.dev` or `.env.example` files are missing          | Read the missing-template list in the output (`generate_env.sh:57-62`) and restore the file.                                                      |
| Backend cannot reach Redis                | `REDIS_HOST` points at the wrong host                               | Update `REDIS_HOST` in `backend/.env` (`README.md:105-107`).                                                                                      |
| Port already in use                       | Another service or a previous run holds the port                    | Stop the conflicting process, then restart the service (`run.sh:7`).                                                                              |
| Supabase commands fail immediately        | Docker daemon is not running                                        | Start Docker, then rerun `npm run dev:supabase`.                                                                                                  |
| Edge functions fail to start              | The Supabase CLI is not installed or the local stack is not running | Install dependencies with `npm run install-deps`, then run `npm run dev:supabase` before `npm run dev:supabase-functions` (`package.json:14-15`). |

## Known gaps

- The exact local behaviour of third-party enrichment and email-verification providers is not documented. Use the mock services or configure the provider keys listed in `backend/.env.dev`.
- `run.sh` does not start the PostgreSQL import worker or the Supabase local stack; both are explicit steps (`run.sh:1-10`, `package.json:14`).

## Related docs

- [Documentation hub](../README.md)
- [Platform overview](./overview.md)
- [Newcomer guide](../onboarding/newcomer-guide.md)
- [First week](../onboarding/first-week.md)
- [Troubleshooting runbook](../runbooks/troubleshooting.md)
