# Local development

This is the single canonical place to run the stack. `README.md`, `AGENTS.md`, and [architecture.md](architecture.md) link here instead of repeating the startup blocks.

## Prerequisites

- **Node.js >= 24** (the `engines` field in `backend/package.json` and `frontend/package.json`).
- **Bun >= 1.1.0** (`micro-services/emails-fetcher/package.json` and `micro-services/sms-gateway-mock/package.json`).
- **Docker** with the Compose plugin — local Supabase and Redis run in containers.
- **Supabase CLI ^2.88.0** — installed as a root devDependency by `npm run install-deps`.
- **Deno 2.x** — only for the edge-function tests. The repo pins no Deno version.

## Bring the stack up

`run.sh` is the single entry point. It does not generate env files, start Supabase, or start Redis, so do those first.

```bash
# from the repository root
npm run install-deps
npm run dev:generate-env
npm run dev:supabase
docker compose -f docker-compose.dev.yml up -d redis
npm run dev:all
```

`dev:generate-env` copies each `.env.dev` to `.env`; the frontend has only `.env.example`, so `generate_env.sh` falls back to it. Start only the `redis` service from `docker-compose.dev.yml`: the full file also starts OpenWA and a second SMS gateway mock on `8085`, which collides with the one `run.sh` starts.

## The nine processes

`run.sh` starts these in the background and waits:

| Process                   | Port                          | Script                                |
| ------------------------- | ----------------------------- | ------------------------------------- |
| Backend API               | `8081`                        | `dev:backend-api`                     |
| Contact-extraction worker | —                             | `dev:backend-worker`                  |
| Email-verification worker | —                             | `dev:backend-email-worker`            |
| Signature worker          | —                             | `dev:backend-email-signature-worker`  |
| Enrichment mock           | `8083`                        | `dev:backend-mock-external-services`  |
| Emails fetcher            | `8084`                        | `dev:micro-services-emails-fetcher`   |
| SMS gateway mock          | `8085`                        | `dev:micro-services-sms-gateway-mock` |
| Supabase edge functions   | `54321` under `/functions/v1` | `dev:supabase-functions`              |
| Frontend                  | `8082`                        | `dev:frontend`                        |

**Port 8083 is shared.** The enrichment mock hardcodes `8083` (`backend/src/mocks/enrichment/config.ts:12`), and Supabase's local edge-runtime inspector defaults to the same port (`supabase/config.toml:295`). If the mock fails with `EADDRINUSE`, change `inspector_port` in `supabase/config.toml`; there is no environment override for the mock's port.

## Verify it works

- **Frontend:** open <http://localhost:8082>; Nuxt prints `Local: http://localhost:8082`.
- **API:** `curl -i localhost:8081` returns an HTTP response (404 is fine — it proves the listener); the log says `Server is running on port 8081.`
- **Fetcher:** log says `Server is running on port 8084.`
- **SMS mock:** log says `Server is running on port 8085.`
- **Enrichment mock:** log says `Started mock servers for local development.`
- **Signature worker:** log says `Consumer group created.` (or `Consumer group already created`).
- **Contact-extraction and verification workers:** no port and no startup banner; they stay attached and log Redis or Zod errors immediately.
- **Edge functions:** `supabase functions serve` prints its `http://127.0.0.1:54321/functions/v1` URL.

## Run the tests

```bash
npm run test:unit --prefix ./backend # Jest
npm run test --prefix ./frontend # Vitest; watch mode, add `-- --run` for one pass
npm run test:unit --prefix ./micro-services/emails-fetcher # Jest
npm run test:unit --prefix ./micro-services/sms-gateway-mock # Jest
```

Edge functions use Deno tests colocated with each function. Run them from the function directory so its `deno.json` import map applies:

```bash
cd supabase/functions/sms-campaigns
deno test
```

The `sms-campaigns` suite is pure unit tests and needs no Supabase. Tests that talk to Supabase — for example `supabase/functions/mining-sources/index.test.ts` — need `supabase start` plus `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the environment (the edge runtime injects these when serving; `deno test --env-file=<file>` does not). The frontend Vitest suite is not wired into CI.

## Self-hosting this fork

`docker-compose.yml` is the supported path. Copy `.env.docker` to `.env`, fill in the required Supabase and SMTP values, then:

```bash
docker compose up -d --build
```

`docker-compose.prod.yml` and `Caddyfile.prod.conf.j2` are not part of this path. They are OpenWA/Traefik scaffolding that references an `auth-service` container, `JWT_SECRET`, `GITHUB_CLIENT_ID`, and a `leadminer.example.com` host, none of which exist in this repository. Ignore them unless you are porting that setup.

## Known gaps

- `package.json`'s `dev:backend-postgresql-worker` points at `backend/src/workers/postgresql-import/index.ts`, which does not exist.

## Related docs

[README.md](../README.md) covers the project; [architecture.md](architecture.md) the processes and stores; [mining-pipeline.md](mining-pipeline.md) the stages and Redis contract; [api.md](api.md) the HTTP routes; [campaigns.md](campaigns.md) campaign behaviour.
