# SMS Campaign Test Report — 2026-07-27

**Branch:** `fix/qa-bugs-batch`
**Test target:** `micro-services/sms-gateway-mock/` (Express + Bun microservice)
**Test date:** 2026-07-27

## Executive Summary

6 parallel test lanes executed across 2 providers (simple-sms-gateway, smsgate) × 3 scenarios (happy path, partial failure, unsubscribe flow).

| Provider | Happy Path | Partial Failure | Unsubscribe Flow |
|----------|-----------|-----------------|------------------|
| simple-sms-gateway | **FAIL** | **FAIL** | **FAIL** |
| smsgate | **FAIL** | **PARTIAL** | **FAIL** |

**Overall verdict: FAIL** — Multiple critical bugs found in variable substitution, DB stats aggregation, and unsubscribe exclusion logic.

---

## Test Infrastructure

- **Mock service:** `micro-services/sms-gateway-mock/` running on port 8085
- **ngrok tunnel:** `https://3a23-197-240-125-171.ngrok-free.app`
- **Edge runtime:** `127.0.0.1:54321/functions/v1/`
- **Test user:** `346eee1b-48ad-4576-af41-8f4a423afb9f` (test@gmail.com)
- **Gateways:**
  - `test` (simple-sms-gateway, id=`71ddb94b-5a2b-4c21-9fb4-6b4c4e5fcde5`)
  - `smsgate-test` (smsgate, id=`300c4c83-c31b-429f-b70f-933e74d31a0a`)
- **Contacts:** 200 persons with E.164 phone numbers

---

## Per-Lane Results

### Lane 1: simple-sms-gateway × Happy Path

**Result:** FAIL

**Issue:** Critical infrastructure failure. Supabase edge function cannot reach the `simple-sms-gateway` mock endpoint via ngrok.

- Error: `"Unexpected token 'F', \"Function not found\" is not valid JSON"`
- Same ngrok tunnel works for `smsgate` provider but fails for `simple-sms-gateway`
- All 10 recipients marked as failed, 0 messages reached the mock

**Root cause hypothesis:** Path-based routing difference or ngrok domain restriction in Supabase Edge Runtime environment.

---

### Lane 2: simple-sms-gateway × Partial Failure

**Result:** FAIL

**Mock config:** successRate=0.5, delayMs=50, failStatusCode=503

**Bugs found:**

1. **Recipient status ignores mock response** — All 10 recipients show `send_status='sent'` in DB, but mock store shows 5 failures (15 success, 5 failure out of 20 total messages). Edge function ignores the actual `success` field from the mock.
2. **Campaign stats not updated** — `sent_count=0`, `failed_count=0` despite 10 recipients being processed.
3. **`{{code}}` variable not substituted** — Messages show `"your code is ."` instead of `"your code is PFA01"`.
4. **Mock success rate not enforced** — Configured for 50% but got 75% success (15/20). Either mock isn't enforcing the rate or requests are being cached.
5. **Inconsistent unsubscribe URL** — Some messages use token from `personalization_data.unsubscribe_short_token`, others generate auto tokens (`UNS01`, `UNS02`, etc.).

---

### Lane 3: simple-sms-gateway × Unsubscribe Flow

**Result:** FAIL

**Campaign 1:** 5 recipients, all sent, 3 unsubscribe URLs clicked (returned HTTP 200)
**Campaign 2:** 5 recipients, 3 sent + 2 failed

**Bugs found:**

1. **campaignId not passed to provider send()** — Processor doesn't pass `campaignId` to the SMS provider's send method (line 829 of index.ts), so X-Campaign-Id header is not set.
2. **SMS unsubscribe exclusion not implemented** — Processor never checks `sms_campaign_unsubscribes` before sending. All 3 unsubscribed contacts were sent to in Campaign 2.
3. **`{{code}}` personalization not rendered** — Template variable is empty in rendered message body.
4. **Unsubscribe URL routing mismatch** — `buildSmsUnsubscribeUrl` uses `FRONTEND_HOST` (`http://localhost:8082`) but actual handler is at `campaigns-track/unsubscribe/:token`.

---

### Lane 4: smsgate × Happy Path

**Result:** FAIL

**Campaign:** 10 recipients, all sent via smsgate

**Bugs found:**

1. **`{{code}}` variable not substituted** — `buildSmsTemplateContext()` does not extract `code` from `personalization_data`. Only name, email, location, etc. are mapped. `code` is missing entirely.
2. **`{{unsubscribeUrl}}` not substituted in main template** — Not added to template context after `shortenUrl()`. Footer template `"Unsubscribe me: {{unsubscribeUrl}}"` never gets substituted.
3. **DB counters not updated** — `sms_campaigns.sent_count` remains 0 and `sms_fleet_gateways.sent_today` remains 0 despite all 10 recipients marked `sent`.
4. **Credentials mismatch** — Request used fleet gateway credentials (`test-user:test-pass`) instead of profile credentials when `fleet_mode_enabled=false`.

**Verified working:**
- Basic Auth header received correctly
- All messages have provider='smsgate'
- All success=true
- All bodies have rendered `{{name}}`
- Unsubscribe URLs are unique (10 unique short tokens)
- Routing to `/smsgate/3rdparty/v1/messages` correct

---

### Lane 5: smsgate × Partial Failure

**Result:** PARTIAL PASS

**Mock config:** global successRate=1.0; smsgate override successRate=0.3, failStatusCode=429, failMessage="SMSGate rate limit"

**Verified working:**
- Per-provider override correctly applied: failed messages returned status 429 (not 500 global)
- Failure message contains "SMSGate rate limit" (not "Mock gateway unavailable")
- Mock correctly parses `textMessage: { text: ... }` and `phoneNumbers: [...]`
- Mock correctly validates Basic Auth for smsgate

**Issues encountered:**

1. **Campaign insert instability** — Campaigns inserted via SQL disappear before recipients can be added (possibly RLS policies or triggers)
2. **Edge function auth rejection** — Edge function returns "Missing authorization header" from runtime auth middleware, preventing HTTP-triggered campaign processing

**Unable to verify:** Full flow with SMP-coded recipients due to campaign instability.

---

### Lane 6: smsgate × Unsubscribe Flow

**Result:** FAIL

**Campaign 1:** 5 recipients, all sent, 2 unsubscribe URLs clicked (returned HTTP 200)
**Campaign 2:** 5 recipients

**Bugs found:**

1. **CRITICAL: Unsubscribed contacts NOT excluded from subsequent campaigns** — Charles (+12002000000) and Anna (+18648680002) both unsubscribed after Campaign 1, but both received Campaign 2.
2. **MAJOR: `sent_count` shows 0** — Despite all 5 recipients having `send_status = 'sent'`.

**Verified working:**
- Unsubscribe mechanism records unsubscribes correctly (2 rows in `sms_campaign_unsubscribes`)
- All bodies have rendered `{{name}}`
- All bodies have rendered `{{unsubscribeUrl}}`
- Unsubscribe URLs are unique

---

## Cross-Cutting Bugs

### 1. `{{code}}` variable not substituted (Lanes 2, 3, 4)

**Impact:** HIGH — Personalization data `code` field is not extracted by `buildSmsTemplateContext()`.

**Evidence:**
- Lane 2: `"your code is ."` (empty)
- Lane 3: `"your code is ."` (empty)
- Lane 4: `"your code is , unsubscribe:"` (empty)

**Root cause:** `buildSmsTemplateContext()` only maps: `name`, `fullName`, `givenName`, `familyName`, `email`, `emailDomain`, `location`, `worksFor`, `jobTitle`, `alternateName`, `telephone`, `seniority`, `recency`, `occurrence`, `conversations`, `repliedConversations`, `sender`, `recipient`. The `code` field is missing.

### 2. DB counters not updated (Lanes 2, 4, 6)

**Impact:** HIGH — Campaign statistics are completely broken.

**Evidence:**
- Lane 2: `sent_count=0`, `failed_count=0` (10 recipients processed)
- Lane 4: `sent_count=0`, `failed_count=0` (10 recipients sent)
- Lane 6: `sent_count=0` (5 recipients sent)
- `sms_fleet_gateways.sent_today` also remains 0

**Root cause:** Processor completes but fails to persist counter updates to the DB.

### 3. Unsubscribe exclusion not implemented (Lanes 3, 6)

**Impact:** CRITICAL — GDPR/compliance risk. Unsubscribed contacts continue receiving SMS campaigns.

**Evidence:**
- Lane 3: 3 unsubscribed contacts all received Campaign 2
- Lane 6: 2 unsubscribed contacts both received Campaign 2

**Root cause:** The processor has no check to exclude contacts whose phone numbers appear in `sms_campaign_unsubscribes` for the same user.

### 4. `{{unsubscribeUrl}}` not substituted in main template (Lane 4)

**Impact:** MEDIUM — Unsubscribe URL is blank in the main message body.

**Evidence:** Lane 4: `"Hi Nancy, your code is , unsubscribe:"` — `{{unsubscribeUrl}}` renders as empty.

**Root cause:** `buildSmsTemplateContext()` does not include `unsubscribeUrl` in the context. The short URL is only available via `shortenUrl()` in a separate step and is never added back as `unsubscribeUrl` in the template context.

---

## Infrastructure Issues

### 1. simple-sms-gateway ngrok connectivity (Lane 1)

**Symptom:** Edge function returns `"Function not found"` when calling `simple-sms-gateway` endpoint via ngrok, while `smsgate` works fine on the same tunnel.

**Hypotheses:**
- Path-based routing: `/simple-sms-gateway/send-sms` vs `/smsgate/3rdparty/v1/messages`
- ngrok-free.app domain restrictions in Supabase Edge Runtime
- Edge function runtime blocking certain URL patterns

### 2. Campaign insert instability (Lane 5)

**Symptom:** Campaigns inserted via SQL disappear moments after insert.

**Hypotheses:**
- RLS policies deleting campaigns without proper auth context
- Database triggers rolling back inserts
- Connection to wrong schema or database

### 3. Edge function auth rejection (Lane 5)

**Symptom:** Edge function returns "Missing authorization header" even with correct Bearer token.

**Hypotheses:**
- Runtime auth middleware (`getAuthToken` at line 86) rejecting valid tokens
- Service role key not properly configured in edge function environment

---

## Recommendations

### Immediate fixes (blocking release)

1. **Add `code` to `buildSmsTemplateContext()`** — Map `personalization_data.code` to template context
2. **Fix DB counter updates** — Ensure `sent_count`, `failed_count`, and `sent_today` are persisted after processing
3. **Implement unsubscribe exclusion** — Check `sms_campaign_unsubscribes` before sending to each contact
4. **Add `unsubscribeUrl` to template context** — Include the shortened URL in `buildSmsTemplateContext()`

### Follow-up investigations

1. **Investigate simple-sms-gateway ngrok connectivity** — Determine if this is an environment-specific issue or a code bug
2. **Investigate campaign insert instability** — Check RLS policies and triggers
3. **Investigate edge function auth rejection** — Verify service role key configuration
4. **Fix campaignId passing** — Ensure `campaignId` is passed to provider send() for X-Campaign-Id header
5. **Review credentials sourcing** — Ensure profile credentials are used when `fleet_mode_enabled=false`

---

## Appendix: Test Data

### Gateways

| Name | Provider | ID | Base URL |
|------|----------|-----|----------|
| test | simple-sms-gateway | 71ddb94b-5a2b-4c21-9fb4-6b4c4e5fcde5 | https://3a23-197-240-125-171.ngrok-free.app/simple-sms-gateway |
| smsgate-test | smsgate | 300c4c83-c31b-429f-b70f-933e74d31a0a | https://3a23-197-240-125-171.ngrok-free.app/smsgate |

### Daily Limits

| Gateway | Daily | Monthly |
|---------|-------|---------|
| test | 100 | 10 |
| smsgate-test | 100 | 1000 |

### Mock Configuration

- Global: successRate=1.0, delayMs=0
- Per-provider overrides: smsgate successRate=0.3, failStatusCode=429, failMessage="SMSGate rate limit"
