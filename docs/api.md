# API reference

Leadminer exposes two HTTP surfaces. The **backend** is an Express app for mining,
contacts, enrichment and SMTP senders. **Edge functions** (Supabase, Deno + Hono) own
campaigns, tracking, source credentials and account deletion. Backend routes live under
`/api`; edge routes live under `/functions/v1/<function>`. Auth is either a Supabase user
JWT (sent as `x-sb-jwt` to the backend, `Authorization: Bearer` to edge functions) or the
service-role key for internal calls.

## Backend HTTP routes

Routes are mounted in `backend/src/app.ts`; each table follows one router file. Backend
auth is the `x-sb-jwt` header (`backend/src/services/auth/SupabaseAuthResolver.ts`). A
missing or invalid token returns `401 {"message":"No token found, authorization denied"}`.
`/api/*` also accepts `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` for internal
calls; the user is then resolved from a `:userId` route or query parameter
(`backend/src/middleware/auth.ts`).

**`/api/imap`** — `backend/src/routes/imap.routes.ts`, `stream.routes.ts`, `mining.routes.ts`

| METHOD | path                                      | auth       | handler                                            |
| ------ | ----------------------------------------- | ---------- | -------------------------------------------------- |
| POST   | `/api/imap/boxes`                         | `x-sb-jwt` | `getImapBoxes`                                     |
| GET    | `/api/imap/mine/:type/:id/progress/`      | `x-sb-jwt` | `streamProgress`                                   |
| POST   | `/api/imap/mine/sources/imap`             | `x-sb-jwt` | `createImapMiningSource`                           |
| GET    | `/api/imap/mine/:userId/`                 | `x-sb-jwt` | `getMiningTask`                                    |
| POST   | `/api/imap/mine/{email,file,pst}/:userId` | `x-sb-jwt` | `startMining`, `startMiningFile`, `startMiningPST` |
| POST   | `/api/imap/mine/:type/:userId/:id`        | `x-sb-jwt` | `stopMiningTask`                                   |

**`/api` (contacts)** — `backend/src/routes/contacts.routes.ts`

| METHOD | path                               | auth       | handler             |
| ------ | ---------------------------------- | ---------- | ------------------- |
| POST   | `/api/contacts/export/:exportType` | `x-sb-jwt` | `exportContactsCSV` |
| POST   | `/api/contacts/verify`             | `x-sb-jwt` | `verifyEmailStatus` |

**`/api/enrich`** — `backend/src/routes/enrichment.routes.ts`

| METHOD | path                                            | auth       | handler                            |
| ------ | ----------------------------------------------- | ---------- | ---------------------------------- |
| POST   | `/api/enrich/person`, `/api/enrich/person/bulk` | `x-sb-jwt` | `enrichPerson`, `enrichPersonBulk` |
| POST   | `/api/enrich/webhook/:id`                       | none       | `enrichWebhook`                    |

**`/api` (SMTP senders)** — `backend/src/routes/smtp-senders.routes.ts`

| METHOD         | path                                        | auth       | handler                                     |
| -------------- | ------------------------------------------- | ---------- | ------------------------------------------- |
| GET            | `/api/smtp-senders`                         | `x-sb-jwt` | `listSenders`                               |
| POST           | `/api/smtp-senders`                         | `x-sb-jwt` | `createSender`                              |
| POST           | `/api/smtp-senders/autodetect`              | `x-sb-jwt` | `autodetect`                                |
| POST           | `/api/smtp-senders/regenerate-from-sources` | `x-sb-jwt` | `regenerateFromSources`                     |
| GET/PUT/DELETE | `/api/smtp-senders/:id`                     | `x-sb-jwt` | `getSender`, `updateSender`, `deleteSender` |
| POST           | `/api/smtp-senders/:id/test`                | `x-sb-jwt` | `testSender`                                |

Mining POSTs and `/imap/boxes` are rate-limited to 10 requests/minute; contacts routes to
100 per 15 minutes (`backend/src/routes/*.ts`).

## Edge-function routes

Each function mounts a Hono app with `.basePath('/<functionName>')`; Supabase removes the
`/functions/v1/<function>` prefix before the app sees the path. `verify_jwt` is set per
function in `supabase/config.toml`. Routes marked **public** have no auth middleware.
`fetch-mining-source` is internal, returns decrypted credentials, and must never be called
from a browser.

| function                     | METHOD              | path                                                               | purpose                                     |
| ---------------------------- | ------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| `campaigns-track`            | GET                 | `/click/:token`                                                    | Resolve click token, count, redirect        |
| `campaigns-track`            | GET                 | `/open/:token`                                                     | Record open, return 1×1 GIF                 |
| `campaigns-track`            | GET                 | `/unsubscribe/:token`                                              | Record opt-out, redirect to frontend        |
| `email-campaigns`            | POST                | `/campaigns/sender-options`                                        | List usable senders                         |
| `email-campaigns`            | POST                | `/campaigns/create`, `/campaigns/preview`                          | Create / preview                            |
| `email-campaigns`            | GET                 | `/campaigns/:id/status`                                            | Poll status and counts                      |
| `email-campaigns`            | POST                | `/campaigns/:id/stop`, `/campaigns/:id/restart`                    | Cancel / requeue                            |
| `email-campaigns`            | DELETE              | `/campaigns/:id`                                                   | Delete campaign and children                |
| `email-campaigns`            | POST                | `/campaigns/process`                                               | Processor (service role)                    |
| `email-campaigns`            | GET                 | `/unsubscribe/:token`, `/track/open/:token`, `/track/click/:token` | Legacy tracking entry points                |
| `email-campaigns`            | POST                | `/email-sending-request`                                           | Email a send request to the fallback sender |
| `email-templates`            | GET                 | `/` (`?language=`)                                                 | Read an email template                      |
| `email-templates`            | POST                | `/`                                                                | Store template in user metadata             |
| `sms-campaigns`              | GET                 | `/providers/status`                                                | Provider configuration check                |
| `sms-campaigns`              | POST                | `/providers/smsgate`                                               | Save SMSGate credentials                    |
| `sms-campaigns`              | GET                 | `/quota`                                                           | Monthly gateway quota                       |
| `sms-campaigns`              | POST                | `/campaigns/create`, `/campaigns/preview`                          | Create / preview                            |
| `sms-campaigns`              | GET                 | `/campaigns`                                                       | List SMS campaigns                          |
| `sms-campaigns`              | GET                 | `/campaigns/:id`                                                   | Campaign detail                             |
| `sms-campaigns`              | POST                | `/campaigns/:id/stop`, `/campaigns/:id/restart`                    | Cancel / requeue                            |
| `sms-campaigns`              | DELETE              | `/campaigns/:id`                                                   | Delete                                      |
| `sms-campaigns`              | GET/POST/PUT/DELETE | `/fleet/gateways`, `/fleet/gateways/:id`                           | Manage fleet gateways                       |
| `sms-campaigns`              | POST                | `/fleet/gateways/:id/test`                                         | Test a gateway                              |
| `sms-campaigns-process`      | POST                | `/process`                                                         | SMS processor (service role)                |
| `sms-fleet`                  | GET/POST            | `/gateways`                                                        | List/add gateways                           |
| `sms-fleet`                  | PUT/DELETE          | `/gateways/:id`                                                    | Edit/remove a gateway                       |
| `whatsapp-campaigns`         | GET/POST/DELETE     | `/sessions`, `/sessions/:id`                                       | Manage OpenWA sessions                      |
| `whatsapp-campaigns`         | POST                | `/sessions/:id/qr`                                                 | Fetch the pairing QR                        |
| `whatsapp-campaigns`         | POST                | `/campaigns/create`, `/campaigns/preview`                          | Create / preview                            |
| `whatsapp-campaigns`         | GET                 | `/campaigns`                                                       | List WhatsApp campaigns                     |
| `whatsapp-campaigns`         | GET                 | `/campaigns/:id`                                                   | Campaign detail                             |
| `whatsapp-campaigns`         | POST                | `/campaigns/:id/stop`, `/campaigns/:id/restart`                    | Cancel / requeue                            |
| `whatsapp-campaigns`         | DELETE              | `/campaigns/:id`                                                   | Delete                                      |
| `whatsapp-campaigns-process` | POST                | `/process`                                                         | WhatsApp processor (service role)           |
| `whatsapp-webhook`           | POST                | `/webhook`                                                         | OpenWA delivery/read webhook (**public**)   |
| `delete-user`                | DELETE              | `/`                                                                | Delete user data and auth account           |
| `delete-mining-source`       | POST                | `/`                                                                | Delete a mining source by email             |
| `fetch-mining-source`        | POST                | `/`                                                                | Internal credential fetch (service role)    |
| `imap`                       | GET                 | `/` (`?email=`)                                                    | IMAP autoconfig for an address              |
| `mining-sources`             | POST                | `/`                                                                | Create a mining source                      |
| `mining-sources`             | POST                | `/oauth/authorize`                                                 | Start OAuth authorization                   |
| `mining-sources`             | GET                 | `/oauth/callback/:provider`                                        | OAuth callback                              |
| `mining-sources`             | PATCH               | `/:id/config`                                                      | Update source config                        |
| `mining-completion`          | POST                | `/`                                                                | Record mining watermark (service role)      |
| `passive-mining`             | POST                | `/`                                                                | Run passive mining (scheduled)              |
| `mail`                       | POST                | `/passive-mining-failed`                                           | Send failure mail (service role)            |
| `mail`                       | POST                | `/mining-complete`                                                 | Send completion mail (service role)         |
| `mail`                       | POST                | `/send-weekly-passive-mining-reports`                              | Weekly report (scheduled)                   |

## How to call one

Run these from the repository root with the API and local Supabase running. Put a Supabase
user access token in `$TOKEN`; never commit one.

```bash
# Backend: list the current user's SMTP senders
curl -s http://localhost:8081/api/smtp-senders \
  -H "x-sb-jwt: $TOKEN"

# Edge function: list SMS campaigns
curl -s "http://127.0.0.1:54321/functions/v1/sms-campaigns/campaigns" \
  -H "Authorization: Bearer $TOKEN"
```

## Conventions

- **Local base URLs**: backend `http://localhost:8081/api`; edge functions
  `http://127.0.0.1:54321/functions/v1/<function>` (ports from `.env.example` and
  `supabase/config.toml`). Deployed installs serve the same paths from their own host.
- **Edge auth**: `Authorization: Bearer <user access token>`; internal/scheduled calls use
  the service-role key. Public tracking and webhook routes need no header.
- **Backend errors**: `{"message": "..."}`; auth failures are `401` with
  `{"message":"No token found, authorization denied"}` (`backend/src/middleware/errorHandler.ts`).
- **Edge errors**: `{"error": "...", "code"?: "..."}`; validation failures add
  `details: [{path, message}]` (`supabase/functions/_shared/validation.ts`).
- **Shared helpers**: `cors.ts`, `middlewares.ts`, `supabase.ts`, `validation.ts`, `logger.ts`, `short-token.ts`, `openwa-client.ts` under `supabase/functions/_shared/`.

## Related docs

- [Architecture](architecture.md) — processes, stores and request paths.
- [Campaigns](campaigns.md) — channels, tables, tracking and consent.
- [Mining pipeline](mining-pipeline.md) — what the mining routes drive.
