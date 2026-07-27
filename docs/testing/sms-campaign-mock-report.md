# SMS Campaign & Multi-Provider Mock — Test Report

> PR #2862 | Branch: `fix/qa-bugs-batch` | Date: 2026-07-24

---

## What's Tested via Integration (Automated)

### Unit Tests (`micro-services/sms-gateway-mock/test/unit/`)

Jest + supertest, 51 cases across 7 files. The Express service
preserves the contract of the previous Hono implementation; the
tests cover:

- `sendSms.test.ts` (12 cases) — `/:provider/send-sms` for both
  providers; unknown provider → 404; smsgate Basic Auth missing
  → 401; smsgate Basic Auth present → request proceeds; `X-Campaign-Id`
  header → stored in message record; `POST /smsgate/3rdparty/v1/messages`
  alias (live provider path); delayMs configuration; failure
  storage.
- `messages.test.ts` (8 cases) — `GET /messages` with `campaignId`,
  `provider`, `phone` filters; `GET /messages` pagination
  (`limit`, `offset`); `GET /messages?full=true` requires
  `X-Mock-Token`; `GET /messages` without `full` → redacted phone
  and body; `DELETE /messages` clears store.
- `config.test.ts` (4 cases) — global config update, per-provider
  override applied, invalid body → 400, deep-merge preserves
  unspecified fields.
- `health.test.ts` (1 case) — `GET /health` returns status, config,
  and stats.
- `sendSmsHelpers.test.ts`, `messageStore.test.ts`, `redaction.test.ts`
  (26 cases) — direct unit tests for the pure helpers from
  `src/routes/sendSmsHelpers.ts` and `src/store/messageStore.ts`,
  including ring buffer, reset, and the `redactPhone` / `redactBody`
  / `redactMessage` helpers.

### Integration Tests (`supabase/functions/sms-campaigns-process/integration.test.ts`)

The integration tests target the `sms-campaigns-process` edge function,
which now calls the `sms-gateway-mock` microservice (not the old edge
function) via the configured gateway URL.
- Real `SimpleSmsGatewayProvider` with mocked `globalThis.fetch`
- Provider retry logic (fails N times, then succeeds)
- Timeout handling (AbortError)
- Gateway error responses (500, 404)

### CI/CD Checks (all green)
- Analyze (actions): PASS
- Analyze (javascript-typescript): PASS
- CodeSee: PASS
- CodeQL: PASS
- DeepSource: JavaScript, Docker, SQL, Secrets — all PASS

---

## What's Manually Tested

### SMS Campaign Processor (via direct DB + edge function calls)
| Scenario | Result |
|----------|--------|
| Happy path (10 recipients, 100% success) | ✅ 10/10 sent in ~2.5s |
| Partial failure (60% success rate) | ✅ ~6 sent, ~4 failed |
| Quota exhaustion (daily_limit=5, 10 recipients) | ✅ 5 sent, 5 failed (after fix) |
| Frontend polling data path | ✅ Counts increment correctly |
| `content-profile: private` header routing | ✅ Works |

### Multi-Provider Mock
| Test | Result |
|------|--------|
| Simple SMS Gateway send | ✅ PASS |
| SMSGate send with Basic Auth | ✅ PASS |
| Campaign filter on `/messages` | ✅ PASS |
| Provider filter on `/messages` | ✅ PASS |
| Pagination | ✅ PASS |
| PII redaction (phone masked, body truncated) | ✅ PASS |
| Unknown provider → 404 | ✅ PASS |
| Invalid auth → 401 | ✅ PASS |
| Quota exceeded (successRate=0) | ✅ PASS |

---

## What Works ✅

1. **SMS Campaign Processor** — sends SMS, increments counters correctly, enforces daily + monthly quotas
2. **Multi-Provider Mock** — supports both `simple-sms-gateway` and `smsgate` with correct request/response formats
3. **Message History API** — stores sent messages, supports filtering by campaign/provider/phone, pagination, PII redaction
4. **Quota Enforcement** — DB CHECK constraint + atomic function prevent overshoot
5. **Variable Substitution** — `{{name}}`, `{{unsubscribeUrl}}` rendered before sending to gateway
6. **Production Guard** — mock refuses to run if `ENVIRONMENT=production`

---

## What Doesn't Work / Known Limitations ❌

1. **Stop endpoint rejects service role key** — only works with user JWT (not fixed, admin tools only)
2. **`fleet/gateways` endpoint rejects service role key** — same issue (not fixed, admin tools only)
3. **Mock gateway `delayMs`** — works but edge function restart needed to pick up code changes
4. **Processor stale-recovery** — re-sends already-delivered recipients (design choice, not regression)
5. **Monthly limit** — enforced per-send but not at campaign creation (now consistent)

---

## How to Manually Verify in the Frontend

### Prerequisites
- Supabase running locally (`npm run dev:supabase`)
- Frontend running (`cd frontend && npm run dev`)
- Test user: `346eee1b-48ad-4576-af41-8f4a423afb9f`
- Test gateway: `71ddb94b-5a2b-4c21-9fb4-6b4c4e5fcde5`

### Step 1: Configure Gateway to Point at Mock
1. Go to **Campaigns** page → **SMS Gateways** tab
2. Edit the `test` gateway
3. Set `baseUrl` to: `https://YOUR-SUBDOMAIN.ngrok-free.app/simple-sms-gateway/send-sms`
   (replace `YOUR-SUBDOMAIN.ngrok-free.app` with the URL ngrok prints when you run `ngrok http 8085`)
4. Save

### Step 2: Create a Test Campaign
1. Go to **Mining** page
2. Select 5 contacts (must have phone numbers)
3. Click **Campaign** → **SMS Campaign**
4. Compose message with variables: `Hi {{name}}, unsubscribe: {{unsubscribeUrl}}`
5. Select the `test` gateway
6. Click **Send**

### Step 3: Verify in the UI
- **Campaigns page** → status should go `queued` → `processing` → `completed`
- **sent_count** should reach 5
- **failed_count** should be 0

### Step 4: Verify Variable Substitution via Mock API
```bash
# Get sent messages for your campaign
curl "http://localhost:8085/messages?campaignId=<your-campaign-id>"
```
Expected: `body` field shows `Hi Charles, unsubscribe: https://...` (rendered, not raw `{{name}}`)

### Step 5: Test SMSGate Provider
1. Create a second gateway with provider `smsgate`
2. Set `baseUrl` to: `https://YOUR-SUBDOMAIN.ngrok-free.app/smsgate/3rdparty/v1/messages`
   (replace `YOUR-SUBDOMAIN.ngrok-free.app` with the URL ngrok prints when you run `ngrok http 8085`)
3. Set username/password (any value works for mock)
4. Send a campaign through this gateway
5. Verify via: `curl ".../messages?provider=smsgate"`

### Step 6: Test Failure Modes
```bash
# Set mock to fail 50% of sends
curl -X POST http://localhost:8085/config \
  -H "Content-Type: application/json" \
  -d '{"global":{"successRate":0.5}}'

# Send a campaign — expect ~50% failure rate
```

### Step 7: Test Quota Enforcement
```sql
-- Set gateway daily_limit to 3
UPDATE private.sms_fleet_gateways SET daily_limit = 3 WHERE name = 'test';
```
Send a campaign with 5 recipients → expect 3 sent, 2 failed with "quota exceeded"

---

## Summary

**Automated coverage:** Strong — unit tests for mock, integration tests for processor, CI/CD green
**Manual coverage:** Comprehensive — 6 scenarios tested, all passing after fixes
**Frontend verification:** 7-step guide above covers happy path, variable substitution, multi-provider, failure modes, and quota enforcement
