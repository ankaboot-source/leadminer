# SMS Gateway Mock Service

A development-only mock SMS gateway service that simulates the behaviour of `simple-sms-gateway` and `smsgate` providers. Used to test SMS campaign delivery/progress logic without sending real SMS messages.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh) (>=1.1.0) with Node.js compatibility
- **Framework**: Express.js (TypeScript)
- **Validation**: Zod + zod-error
- **Logging**: Winston (console + optional Grafana Loki)
- **Optional Monitoring**: Sentry

## Quick Start

```bash
# Install dependencies
bun install

# Start in development mode (watch)
bun run dev

# Or start directly
bun run start
```

The service starts on **port 8085** by default.

## Production Guard

This service **must not run in production**. If `NODE_ENV` is set to `production`, the process will exit with code `1` immediately on startup.

## API Endpoints

| Method | Path                  | Description                                           |
| ------ | --------------------- | ----------------------------------------------------- |
| GET    | `/health`             | Health check + mock config + stats                    |
| POST   | `/config`             | Update mock behaviour (success rate, delay)           |
| GET    | `/messages`           | Retrieve stored message history                       |
| DELETE | `/messages`           | Clear all stored messages                             |
| POST   | `/:provider/send-sms` | Send a mock SMS via `simple-sms-gateway` or `smsgate` |

### Health Check

```bash
curl http://localhost:8085/health
```

### Send SMS (simple-sms-gateway)

```bash
curl -X POST http://localhost:8085/simple-sms-gateway/send-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"+33612345678","message":"Hello"}'
```

### Send SMS (smsgate, requires Basic Auth)

```bash
curl -X POST http://localhost:8085/smsgate/send-sms \
  -H "Content-Type: application/json" \
  -u "username:password" \
  -d '{"textMessage":{"text":"Hello"},"phoneNumbers":["+33612345678"]}'
```

> **Note**: the live SMSGate provider appends `/3rdparty/v1/messages` to its `baseUrl`. The mock registers both `POST /smsgate/send-sms` (used by direct curl tests) and `POST /smsgate/3rdparty/v1/messages` (used by the campaign processor) so both work.

### Update Mock Config

```bash
# 80% success rate, 100ms delay
curl -X POST http://localhost:8085/config \
  -H "Content-Type: application/json" \
  -d '{"global":{"successRate":0.8,"delayMs":100}}'
```

### Get Message History

```bash
curl "http://localhost:8085/messages?limit=10"
```

### Clear Message History

```bash
curl -X DELETE http://localhost:8085/messages
```

---

For the full test plan covering all endpoints, success/failure scenarios, PII redaction, ring-buffer eviction, and per-provider overrides, see **`docs/testing/sms-campaign-mock-report.md`**.

## Dev Tunnel (ngrok) — required for Supabase → mock

The Supabase edge function runtime runs inside Docker
(`supabase_edge_runtime_leadminer`). Its `localhost` is the
container itself, not your host machine. So when the campaign
processor (`supabase/functions/sms-campaigns-process`) tries
to `fetch("http://localhost:8085/...")` to reach the mock, it
will fail with `ECONNREFUSED`. You must expose the mock via a
public tunnel.

### Option A — ngrok (recommended)

1. Install: https://ngrok.com/download
2. Start the mock: `cd micro-services/sms-gateway-mock && bun run dev`
3. In a second terminal: `ngrok http 8085`
4. Copy the `https://...ngrok-free.app` URL from the ngrok output.
5. In the frontend, go to **Sources → SMS Gateways → Edit** (or Add):
   - For `simple-sms-gateway`: set `baseUrl` to
     `https://YOUR-SUBDOMAIN.ngrok-free.app/simple-sms-gateway/send-sms`
   - For `smsgate`: set `baseUrl` to
     `https://YOUR-SUBDOMAIN.ngrok-free.app/smsgate/3rdparty/v1/messages`
     (note: the live SMSGate provider appends `/3rdparty/v1/messages`
     to its `baseUrl`; the mock accepts that path).
   - Username/password: any non-empty value (mock doesn't validate).
6. Save and trigger a campaign. The processor will hit the mock via ngrok.

Free ngrok URLs change every restart. For a stable URL, sign up
for a paid plan and use the `NGROK_DOMAIN` env var + `ngrok config
add-authtoken <token>`.

### Option B — Cloudflare quick tunnel (no signup)

```bash
# Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
cloudflared tunnel --url http://localhost:8085
```

Copy the `https://...trycloudflare.com` URL into the gateway `baseUrl`.
Free, no signup. URL changes every restart.

### Option C — Docker Desktop `host.docker.internal`

If you're on Docker Desktop (Mac/Windows) and running the mock on
the host, you can use the magic hostname `host.docker.internal`:

- baseUrl: `http://host.docker.internal:8085/simple-sms-gateway/send-sms`

This does NOT work on Linux Docker Engine without extra config.

### Option D — Same Docker network (Linux)

If you want a clean Linux setup, run the mock in the same
`docker-compose` stack as Supabase and reference it by service name:

```yaml
services:
  sms-gateway-mock:
    # (the docker-compose.dev.yml service above)
    networks:
      - supabase_default # or whatever Supabase uses
```

Then the processor can hit `http://sms-gateway-mock:8085/...` directly,
no tunnel. This is the cleanest long-term setup if you want to
CI-test campaigns against the mock.

### ngrok configuration (advanced)

`.env.dev` accepts:

- `NGROK_AUTHTOKEN` — your ngrok account authtoken (free tier OK).
- `NGROK_DOMAIN` — fixed subdomain (paid plan only).

A future `bun run dev:ngrok` helper script can wrap `ngrok http 8085`
and auto-extract the public URL from the ngrok API. Not in scope
for this PR; the manual workflow above is sufficient.
