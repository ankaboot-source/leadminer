# Testing Guide — SMS Gateway Mock Service

## Test isolation

The in-memory state singleton (`src/store/messageStore.ts`) is shared
across every test in a single Jest process. Every test file that
imports anything from `src/store/messageStore.ts` MUST reset state in
`beforeEach`:

```ts
import { resetState } from '../../src/store/messageStore';
import {
  getMessageCount,
  resetState as _reset
} from '../../src/store/messageStore';

beforeEach(() => {
  resetState();
});
```

If you write tests that import the store directly (unit tests), you
must also reset. If you only hit the HTTP API (integration tests
via `supertest`), resetState is still required because the store is
process-global, not request-scoped.

## Running Unit Tests

```bash
bun run test:unit
```

## Test Groups (automated in Phase 2)

The following test groups will be implemented in `test/unit/`:

1. **Provider Validation** — Unknown providers return 404; only `simple-sms-gateway` and `smsgate` are accepted.

2. **Success / Failure Scenarios** — With `successRate: 1.0` all requests succeed; with `successRate: 0.0` all fail with the configured `failStatusCode` and `failMessage`.

3. **Per-Provider Overrides** — Setting `providers.smsgate.successRate: 0.0` causes only smsgate requests to fail, while simple-sms-gateway continues to use the global rate.

4. **Message History** — `GET /messages` returns stored messages with correct pagination (`limit`/`offset`), filtering (`campaignId`, `provider`, `phone`), and PII redaction (phone partially masked, body truncated).

5. **PII Redaction** — Full (unredacted) messages require `X-Mock-Token` header matching `SMS_GATEWAY_MOCK_TOKEN`; without it, phone numbers are masked (e.g., `+336****5678`) and message bodies are truncated to 50 chars.

6. **Ring Buffer Eviction** — When more than `SMS_GATEWAY_MOCK_MAX_MESSAGES` (default 10 000) messages are stored, the oldest messages are evicted and the campaign index is updated accordingly.

7. **Reset** — Clearing messages (`DELETE /messages`) empties the store, campaign index, and insertion order.

## Manual Test Scenarios

These scenarios verify the live service behaviour and are the basis for the automated tests above.

### Scenario 1 — Health check returns config and stats

```bash
curl http://localhost:8085/health
```

Expected: `200` with `status: "ok"`, `service: "sms-gateway-mock"`, `config` object, and `stats.totalMessages`.

### Scenario 2 — simple-sms-gateway send-sms returns mock ID

```bash
curl -X POST http://localhost:8085/simple-sms-gateway/send-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"+33612345678","message":"Hello"}'
```

Expected: `200` with `{ id: "mock_1", messageId: "mock_1", success: true }`.

### Scenario 3 — smsgate rejects missing Basic Auth

```bash
curl -X POST http://localhost:8085/smsgate/send-sms \
  -H "Content-Type: application/json" \
  -d '{"textMessage":{"text":"Hello"},"phoneNumbers":["+33612345678"]}'
```

Expected: `401` with `{ message: "Missing or invalid Authorization header", success: false }`.

### Scenario 4 — smsgate succeeds with Basic Auth

```bash
curl -X POST http://localhost:8085/smsgate/send-sms \
  -H "Content-Type: application/json" \
  -u "user:pass" \
  -d '{"textMessage":{"text":"Hello"},"phoneNumbers":["+33612345678"]}'
```

Expected: `200` with `{ id: "mock_1", messageId: "mock_1", success: true }`.

### Scenario 5 — Config update changes success rate to 0%

```bash
curl -X POST http://localhost:8085/config \
  -H "Content-Type: application/json" \
  -d '{"global":{"successRate":0.0,"failStatusCode":429}}'
```

Then send any SMS — expected: configured `failStatusCode` (429) with `{ success: false }`.

### Scenario 6 — Message history with redaction

```bash
curl "http://localhost:8085/messages?limit=5"
```

Expected: `200` with redacted `phone` and truncated `body`. To get full data:

```bash
curl "http://localhost:8085/messages?limit=5&full=true" \
  -H "X-Mock-Token: dev-mock-token"
```

### Scenario 7 — Production guard

Set `NODE_ENV=production` in `.env` and try to start the service — it should exit with code `1` immediately.
