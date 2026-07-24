# SMS Campaign Test Plan

> Phase 1 deliverables — DB reset, test data inventory, component/API surface map, manual scenarios

---

## 1. Test Data Inventory

### User Under Test

| Field | Value |
|-------|-------|
| `user_id` | `346eee1b-48ad-4576-af41-8f4a423afb9f` |
| `email` | `test@gmail.com` |

### Contacts (via `private.persons`)

| Metric | Count |
|--------|-------|
| Total persons for user | 200 |
| Persons with `telephone IS NOT NULL AND array_length(telephone,1) > 0` | **200** |

All 200 contacts have at least one phone number in E.164 format (`+1NNNNNNNNNN`). **No synthetic test contacts needed** — we have sufficient data for campaigns up to the 200 daily/monthly limit.

### Sample Contacts (first 5 with phones)

| id | name | telephone |
|----|------|-----------|
| `00316bdd-...` | Charles Jackson | `{+12002000000}` |
| `0062b9a5-...` | Raymond Ruiz | `{+15375390001}` |
| `0096ce46-...` | Anna Cooper | `{+18648680002}` |
| `01834b59-...` | Joshua Hill | `{+13913970003}` |
| `03324074-...` | Anthony Clark | `{+16286260004}` |

### Gateway

| id | name | provider | daily_limit | monthly_limit | is_active |
|----|------|----------|-------------|---------------|-----------|
| `71ddb94b-5a2b-4c21-9fb4-6b4c4e5fcde5` | test | `simple-sms-gateway` | 200 | 200 | true |

**Gateway config**: `simpleSmsGatewayBaseUrl` must be configured in the gateway's `config` jsonb column (checked at campaign send time).

### FK Constraints That Matter

| Constraint | Detail |
|-----------|--------|
| `sms_campaigns.user_id` → `auth.users(id) ON DELETE CASCADE` | Campaigns cascade if user is deleted |
| `sms_campaign_recipients.campaign_id` → `sms_campaigns(id) ON DELETE CASCADE` | Recipients cascade with campaign |
| `sms_campaign_recipient_gateways.campaign_id` → `sms_campaigns(id) ON DELETE CASCADE` | Assignments cascade with campaign |
| `sms_campaign_recipient_gateways.recipient_id` → `sms_campaign_recipients(id) ON DELETE CASCADE` | |
| `sms_campaign_recipient_gateways.gateway_id` → `sms_fleet_gateways(id) ON DELETE SET NULL` | Deleting a gateway nullifies refs (doesn't break history) |
| `sms_campaign_link_clicks.campaign_id` → `sms_campaigns(id) ON DELETE CASCADE` | |
| `sms_campaign_link_clicks.recipient_id` → `sms_campaign_recipients(id) ON DELETE CASCADE` | |
| `sms_campaign_unsubscribes.campaign_id` → `sms_campaigns(id) ON DELETE SET NULL` | Unsubscribes survive campaign deletion (GDPR) |
| `sms_campaign_unsubscribes.user_id` → `auth.users(id) ON DELETE CASCADE` | |
| `sms_campaign_recipients.unsubscribe_short_token` UNIQUE | Token uniqueness enforced at DB level |
| `sms_campaign_recipient_gateways(campaign_id, recipient_id)` UNIQUE | One assignment per recipient per campaign |
| `sms_campaign_link_clicks.token` UNIQUE | Short token uniqueness enforced at DB level |
| `sms_campaign_unsubscribes(user_id, phone)` UNIQUE | One unsubscribe per user+phone |

---

## 2. Reset Commands (copy-pasteable)

```sql
-- 1. Reset gateway quota
UPDATE private.sms_fleet_gateways SET sent_today = 0;

-- 2. Truncate all campaign-scoped data (order matters for FKs)
TRUNCATE private.sms_campaign_recipients CASCADE;           -- clears recipients + referenced rows
TRUNCATE private.sms_campaign_recipient_gateways CASCADE;    -- clears gateway assignments
TRUNCATE private.sms_campaign_link_clicks;                   -- no cascade needed
TRUNCATE private.sms_campaign_unsubscribes;                  -- no cascade needed
TRUNCATE private.sms_campaigns CASCADE;                      -- clears campaigns + cascades above

-- 3. Verify clean state
SELECT 'campaigns' AS tbl, count(*) FROM private.sms_campaigns
UNION ALL SELECT 'recipients', count(*) FROM private.sms_campaign_recipients
UNION ALL SELECT 'gateway_assignments', count(*) FROM private.sms_campaign_recipient_gateways
UNION ALL SELECT 'link_clicks', count(*) FROM private.sms_campaign_link_clicks
UNION ALL SELECT 'unsubscribes', count(*) FROM private.sms_campaign_unsubscribes;

SELECT id, name, sent_today, daily_limit FROM private.sms_fleet_gateways;
```

**Note**: `sms_campaign_recipient_clicks` and `sms_campaign_recipient_unsubscribes` do NOT exist in the DB schema — do not attempt to truncate them.

---

## 3. Frontend Component Map

### `frontend/src/pages/campaigns.vue`

| Aspect | Detail |
|--------|--------|
| **Role** | Campaign list page — displays both email and SMS campaigns in a `DataView` |
| **Data dependencies** | `$campaignsStore.campaigns` + `$smsFleetStore.gateways` + `$smtpSendersStore.senders` |
| **API calls** | None directly — delegates to stores (RPCs `get_campaigns_overview`, `get_sms_campaigns_overview`) |
| **Edge actions** | `$saasEdgeFunctions('sms-campaigns/campaigns/{id}/stop', POST)`, `.../restart`, `.../{id} DELETE` |
| **Exposed events** | Refresh button, stop/restart/delete dialogs |
| **Polling** | `$campaignsStore.startPolling()` + `$smsFleetStore.startPolling()` both at 60s interval |
| **Gotchas** | Campaign actions use `$saasEdgeFunctions` (not `$api`); action routes use `channelPrefix` (`sms-campaigns` vs `email-campaigns`) |

### `frontend/src/components/campaigns/SmsCampaignComposerDialog.vue`

| Aspect | Detail |
|--------|--------|
| **Role** | Create SMS campaign dialog — message composition, gateway selection, preview, submit |
| **Props** | `visible: boolean`, `selectedContacts: Contact[]` |
| **Emits** | `update:visible`, `campaign-created(campaignId)`, `add-gateway` |
| **API calls** | `$saasEdgeFunctions('sms-campaigns/campaigns/create', POST)` with recipient + message + gatewayIds |
| **Preview** | `$saasEdgeFunctions('sms-campaigns/campaigns/preview', POST)` |
| **Gateway data** | Uses `FleetGatewaySelector` child component (v-model on `selectedGatewayIds`) |
| **Polling after create** | Calls `$smsFleetStore.fetchGateways()` immediately + `setTimeout(8000)` to catch async sends |
| **Gotchas** | (1) `getSelectedRecipients()` deduplicates by phone (only first contact's personalization kept for duplicate phones). (2) After campaign creation, the gateway refresh is a best-effort setTimeout — race with processor is possible. (3) The `selectedGatewayIds` must be non-empty for form validity. |

### `frontend/src/components/sms-fleet/FleetGatewaySelector.vue`

| Aspect | Detail |
|--------|--------|
| **Role** | Gateway selection UI for the campaign composer — lists gateways with checkboxes, add/configure new gateways |
| **Props** | `modelValue: string[]` (selected gateway IDs), `showValidation` |
| **Emits** | `update:modelValue`, `add-gateway` |
| **Data** | Reads from `$smsFleetStore.gateways` (populated by `fetchGateways()` → GET endpoint) |
| **Gateway create** | Calls `$smsFleetStore.createGateway()` → POST to `sms-campaigns/fleet/gateways` |
| **Gotchas** | (1) The add-gateway form requires `ProviderForm` child to emit `@valid` and `@submit`; form submit manually calls `providerFormRef?.handleSubmit()`. (2) Saves config then auto-selects the new gateway. (3) Shows `sent_today/daily_limit` per gateway card. |

### `frontend/src/components/sms-fleet/SmsFleetManagement.vue`

| Aspect | Detail |
|--------|--------|
| **Role** | Full gateway management (list, add, edit, delete, test) — displayed in campaigns page via `SenderFilterTabs` |
| **Props** | `autoAdd`, `hideEmptyState` |
| **Emits** | `gatewayCreated(gateway)` |
| **API calls** | CRUD via `$smsFleetStore` → `sms-campaigns/fleet/gateways` (GET, POST, PUT, DELETE) |
| **Test** | `$smsFleetStore.testGateway()` → POST `sms-campaigns/fleet/gateways/{id}/test` |
| **Gotchas** | (1) Edit dialog does NOT allow changing provider. (2) Uses `nextTick` inside confirm dialog delete. (3) ProviderForm in edit mode pre-fills from `gateway.config` but clears password. |

### `frontend/src/components/mining/buttons/CampaignButton.vue`

| Aspect | Detail |
|--------|--------|
| **Role** | SplitButton in MiningTable toolbar — launches email or SMS campaign composer |
| **Props** | `selectedContacts`, `isExportDisabled` |
| **Emits** | None directly |
| **Data** | Lazy-loads both dialog components via `defineAsyncComponent` |
| **SMS logic** | Disables SMS option if no contact has `telephone` |
| **Events** | `@campaign-created` triggers `$smsFleetStore.fetchGateways()` |
| **Gotchas** | The main button click opens email dialog; SMS is in the dropdown menu. Async components may show empty flash on load. |

### `frontend/src/components/mining/table/MiningTable.vue`

| Aspect | Detail |
|--------|--------|
| **Role** | Main contacts data table — hosts CampaignButton, removes contacts, filters |
| **SMS integration** | Includes `SmsCampaignComposerDialog` with `@campaign-created` handler calling `$smsFleetStore.fetchGateways()` |
| **Gotchas** | The same `SmsCampaignComposerDialog` is mounted here AND in CampaignButton.vue — both use `@campaign-created` to refresh gateways. Two simultaneous fetches on create (harmless but wasteful). |

### `frontend/src/stores/campaigns.ts`

| Aspect | Detail |
|--------|--------|
| **Data source** | `$supabase.schema('private').rpc('get_campaigns_overview')` + `...rpc('get_sms_campaigns_overview')` |
| **SMS mapping** | Maps RPC fields: `sent_count` → `delivered`, `click_count` → `clicked`, `unsubscribe_count` → `unsubscribed` |
| **Polling** | `setInterval(fetchCampaigns, 60000)` |
| **Terminal notifications** | Tracks status transitions via `computeTerminalCampaignNotifications` |
| **Gotchas** | `get_campaigns_overview` is a separate RPC for email campaigns — it's called alongside `get_sms_campaigns_overview`. SMS-specific fields (`provider`, `message_template`, `sender_name`, `gateway_names`) are expected from the RPC but NOT typed in `CampaignOverview`. |

### `frontend/src/stores/sms-fleet.ts`

| Aspect | Detail |
|--------|--------|
| **Data source** | `$saasEdgeFunctions('sms-campaigns/fleet/gateways', GET)` |
| **CRUD** | POST/PUT/DELETE on same endpoint |
| **Test** | POST `sms-campaigns/fleet/gateways/{id}/test` |
| **Polling** | `setInterval(fetchGateways, 60000)` |
| **Gotchas** | (1) Error handling swallows errors via `catch` logging. (2) `updateGateway` sends `updated_at` from client (could drift). (3) `createGateway` hardcodes `is_active: true`. |

### `frontend/src/stores/smtp-senders.ts`

| Aspect | Detail |
|--------|--------|
| **Role** | Email sender store (cross-reference: campaigns page also loads this for `bothSendersEmpty` check) |
| **API** | `$api('/smtp-senders', ...)` — uses backend Express, NOT edge functions |
| **SMS relevance** | None directly, but campaigns.vue reads it to show "no senders" empty state |

---

## 4. Edge Function API Surface

### `sms-campaigns` Edge Function (`supabase/functions/sms-campaigns/index.ts`)

Base path: `/functions/v1/sms-campaigns`

| Route | Method | Purpose | Input Schema | Output |
|-------|--------|---------|-------------|--------|
| `/health` | GET | Health check | — | `{ status, service }` |
| `/providers/status` | GET | Get provider config status | Auth header | `{ smsgateConfigured, simpleSmsGatewayConfigured, twilioAvailable }` |
| `/providers/smsgate` | POST | Save SMSGate credentials | `{ baseUrl?, username?, password? }` | `{ success: true }` |
| `/quota` | GET | Get remaining daily/monthly quota | Query: `timezone` | `{ dailyLimit, monthlyLimit, usedDaily, usedMonthly, remainingDaily, remainingMonthly }` |
| `/campaigns/create` | POST | Create campaign in fleet mode | See `smsCampaignCreateSchema` | `{ campaignId, recipientCount }` |
| `/campaigns/preview` | POST | Send a preview SMS to a test number | Same as create + `testPhoneNumber` | `{ preview, charCount, encoding, parts, sentToPhone?, providerUsed? }` |
| `/campaigns` | GET | List all SMS campaigns for user | Auth header | `{ campaigns: RPC[] }` |
| `/campaigns/:id` | GET | Get single campaign + recipients | Auth header | `{ campaign, recipients }` |
| `/campaigns/:id/stop` | POST | Stop a queued/processing campaign | Auth header | `{ success: true }` |
| `/campaigns/:id/restart` | POST | Restart a cancelled/failed campaign | Auth header | `{ success: true }` |
| `/campaigns/:id` | DELETE | Delete a campaign | Auth header | `{ success: true }` |
| `/fleet/gateways` | GET | List fleet gateways | Auth header | `{ gateways: SmsFleetGateway[] }` |
| `/fleet/gateways` | POST | Create a fleet gateway | `fleetGatewayCreateSchema` | `{ gateway: SmsFleetGateway }` |
| `/fleet/gateways/:id` | PUT | Update a fleet gateway | `fleetGatewayUpdateSchema` | `{ success: true }` |
| `/fleet/gateways/:id` | DELETE | Delete a fleet gateway | Auth header | `{ success: true }` |
| `/fleet/gateways/:id/test` | POST | Test gateway connectivity | Auth header | `{ success, message }` |

**Input schema for campaign create** (`smsCampaignCreateSchema`):

```typescript
{
  selectedPhones?: string[],                    // optional if selectedRecipients provided
  selectedRecipients?: { phone, personalization? }[],
  senderName: string,
  messageTemplate: string,
  footerTextTemplate?: string,
  useShortLinks?: boolean,
  provider?: "smsgate" | "simple-sms-gateway" | "twilio",
  smsgateConfig?: { baseUrl?, username?, password? },
  simpleSmsGatewayConfig?: { baseUrl? },
  timezone?: string,
  fleetMode?: boolean,                          // must be true for fleet path
  selectedGatewayIds?: string[],                // required when fleetMode=true
}
```

### `sms-campaigns-process` Edge Function (`supabase/functions/sms-campaigns-process/index.ts`)

Base path: `/functions/v1/sms-campaigns-process`

| Route | Method | Purpose | Notes |
|-------|--------|---------|-------|
| `/health` | GET | Health check | |
| `/process` | POST | Process a campaign (or auto-select next queued) | Body: `{ campaignId?: string }`. Returns `202 { accepted, campaignId }`. Runs processing in `EdgeRuntime.waitUntil`. |

Key implementation details:
- If no `campaignId`, picks the oldest `queued` or stale `processing` (started >10min ago) campaign
- Processes each recipient with up to 2 retries
- Fleet mode: loads gateway assignments from `sms_campaign_recipient_gateways`, creates providers from gateway config
- Non-fleet mode: reads provider credentials from `private.profiles`
- Calls `increment_gateway_sent_count_atomic` (SQL function with row-level locking + quota check) and `increment_sms_campaign_counts_atomic` per sent/failed recipient
- `beforeunload` handler saves partial `sent_count`/`failed_count` when wall-clock limit hits (so cron can resume)
- Final status: `completed` (if any sent), `failed` (if all failed or processing error), keeps `processing` on partial save

### `sms-gateway-mock` Edge Function (`supabase/functions/sms-gateway-mock/index.ts`)

Base path: `/functions/v1/sms-gateway-mock`

| Route | Method | Purpose | Notes |
|-------|--------|---------|-------|
| `/health` | GET | Health + current config | Returns `{ status, service, config }` |
| `/config` | POST | Update mock behavior at runtime | Body: `{ successRate: 0-1, delayMs, failMessage, failStatusCode, sequentialId, idPrefix }` |
| `/send-sms` | POST | Simulate SMS send | Body: `{ phone, message }`. Returns success/fail based on `successRate` |

Used for integration testing without real SMS providers. The mock's base URL is the gateway's configured endpoint.

---

## 5. PostgREST RPC Surface

### `private.*` Functions

| Function | Args | Purpose | Called by |
|----------|------|---------|-----------|
| `get_sms_campaigns_overview()` | none | Returns campaigns with click/unsubscribe counts for `auth.uid()` | Campaigns store (via Supabase RPC) |
| `get_campaigns_overview()` | none | Returns email campaigns | Campaigns store (via Supabase RPC) |
| `get_unified_campaigns_overview()` | none | Combined email + SMS overview | (Backend?) |
| `increment_gateway_sent_count_atomic(p_gateway_id, p_count)` | uuid, int | Atomically increments gateway `sent_today` with quota check (row lock + reject if exceeded) | Processor (per sent SMS in fleet mode) |
| `increment_sms_campaign_counts_atomic(p_campaign_id, p_sent_increment, p_failed_increment)` | uuid, int, int | Atomically increments campaign `sent_count`/`failed_count` with status guard (rejects if terminal) | Processor (per sent/failed SMS) |
| `reset_daily_gateway_counters()` | none | Resets `sent_today` for gateways whose `last_reset_at < CURRENT_DATE` | Cron (daily) |
| `reset_monthly_gateway_counters()` | none | Resets `sent_this_month` + `sent_today` for gateways whose `last_reset_at < month_start` | Cron (monthly) |
| `trigger_sms_campaign_processor()` | none | `SECURITY DEFINER` — uses `net.http_post` to call `sms-campaigns-process/process` | DB trigger (on campaign insert) |
| `batch_increment_gateway_counts(p_gateway_id, p_count)` | uuid, int | Non-atomic batch increment (no quota check) | (Legacy/cron path) |
| `increment_gateway_sent_count(p_gateway_id, p_count)` | uuid, int | Simple increment without quota check | (Called but not recommended for fleet mode) |
| `get_sms_campaigns_overview()` (public schema) | none | Same as private version but at public schema | Public schema version exists as well |
| `get_gateway_current_usage(p_gateway_id)` | uuid | Returns current gateway usage stats | (Public schema function) |

**`get_sms_campaigns_overview` SQL** (private schema):
```sql
SELECT c.id, c.user_id, c.sender_name, NULL::TEXT AS sender_phone, c.provider,
       c.status, c.recipient_count, c.sent_count, c.failed_count,
       (SELECT COUNT(*) FROM private.sms_campaign_link_clicks cl WHERE cl.campaign_id = c.id) AS click_count,
       (SELECT COUNT(*) FROM private.sms_campaign_unsubscribes u WHERE u.campaign_id = c.id) AS unsubscribe_count,
       c.created_at, c.started_at, c.completed_at
FROM private.sms_campaigns c
WHERE c.user_id = auth.uid()
ORDER BY c.created_at DESC;
```

---

## 6. State Machine: SMS Campaign Lifecycle

```
                  ┌──────────────┐
                  │   queued     │ ◄──────── restart
                  └──────┬───────┘
                         │
                    [processor picks up]
                         │
                    ┌────▼───────┐
              ┌─────┤ processing │◄───── stale recovery (>10min)
              │     └────┬───────┘      (cron/auto-reprocess)
              │          │
              │    ┌─────┴──────┐
              │    ▼            ▼
         ┌────────┐      ┌───────────┐
         │cancelled│     │ completed │
         └────┬────┘     └─────┬─────┘
              │                │
              │           [all sent]
              │           [or partial: sent>0, failed>0]
              │
              │     ┌───────────┐
              └────►│  failed   │  (sent=0, failed>0, or processing error)
                    └─────┬─────┘
                          │
                     [restart → queued]
```

### Transition Triggers

| From | To | Trigger | Who can call | Endpoint |
|------|----|---------|-------------|----------|
| — | `queued` | POST `/campaigns/create` | Auth user (via frontend) | `sms-campaigns` |
| `queued` | `processing` | Processor picks up campaign | Service role (`sms-campaigns-process`) | Internal |
| `processing` | `completed` | All recipients processed (some may have failed) | Processor (in `finally`) | Internal |
| `processing` | `failed` | All recipients failed or processing error | Processor (in `finally`) | Internal |
| `processing` | `processing` (partial) | beforeunload saves partial counts | `beforeunload` handler | Internal |
| `queued`/`processing` | `cancelled` | POST .../stop | Auth user | `sms-campaigns` |
| `cancelled`/`failed` | `queued` | POST .../restart | Auth user | `sms-campaigns` |
| any (non-processing) | deleted | DELETE .../:id | Auth user | `sms-campaigns` |
| `processing` (stale >10min) | `queued` (reset) | Auto-recovery by processor | Processor (via cron/invoke) | Internal |

### Status Guard Rails

- **Stop**: only allowed when `status IN ('queued', 'processing')`
- **Restart**: only allowed when `status IN ('cancelled', 'failed')`
- **Delete**: allowed when `status != 'processing'`
- **Atomic increment**: rejects if campaign is in terminal state (`completed`, `failed`, `cancelled`)

---

## 7. Quoting Paths — Three Tickers the Frontend Reads

### Ticker 1: Campaign Delivery Count
- **Read from**: `$campaignsStore.campaigns[]` → `sent_count` → `delivered`, `failed_count → failed_count`
- **Source**: `get_sms_campaigns_overview` RPC → aggregation of `sent_count` + `failed_count` columns in `sms_campaigns`
- **Update path**: Each processor send/fail → `increment_sms_campaign_counts_atomic(p_campaign_id, sent_incr, failed_incr)`
- **Refresh**: Polled every 60s via `$campaignsStore.startPolling()`

### Ticker 2: Gateway Quota
- **Read from**: `$smsFleetStore.gateways[]` → `sent_today`, `daily_limit`
- **Source**: `sms-campaigns/fleet/gateways` GET endpoint → `sms_fleet_gateways.sent_today`
- **Update path**: Each fleet-mode send → `increment_gateway_sent_count_atomic(p_gateway_id, 1)` (row lock + quota guard)
- **Refresh**: Polled every 60s via `$smsFleetStore.startPolling()`, plus immediate+delayed refresh after campaign create

### Ticker 3: Recipient Statuses
- **Read from**: Not shown in frontend UI directly (only aggregated counts are), but available via `GET /campaigns/:id` → `recipients[].send_status`
- **Source**: `sms_campaign_recipients.send_status` (pending/sent/failed/skipped)
- **Update path**: Per-recipient processor writes

### Update Source Summary

| Update | Mechanism | Atomic? | Quota Guard? |
|--------|-----------|---------|--------------|
| Campaign `sent_count` | `increment_sms_campaign_counts_atomic` RPC | Yes (row lock) | Status guard (rejects if terminal) |
| Campaign `failed_count` | Same RPC | Yes | Same |
| Gateway `sent_today` | `increment_gateway_sent_count_atomic` RPC | Yes (row lock) | Yes (rejects if `sent_today + count > daily_limit`) |
| Gateway `sent_this_month` | Same RPC (but only increments `sent_today`) | Yes | Same |
| Daily reset | `reset_daily_gateway_counters()` | No (bulk UPDATE) | N/A |
| Monthly reset | `reset_monthly_gateway_counters()` | No (bulk UPDATE) | N/A |

---

## 8. Failure Mode Taxonomy

| # | Failure Mode | Expected Behavior | Test Plan |
|---|-------------|-------------------|-----------|
| 1 | **Full success** — all recipients send OK | Status: `completed`, sent_count = N, failed_count = 0, gateway sent_today += N | Create N=5 campaign, verify all sent |
| 2 | **Partial success** — some send, some fail | Status: `completed`, sent_count > 0, failed_count > 0 | Configure mock to fail 50% of sends |
| 3 | **Full failure** — all recipients fail | Status: `failed`, sent_count = 0, failed_count = N | Configure mock to fail 100% |
| 4 | **Gateway quota block** — gateway at daily limit | Processor marks gateway as failed, tries alternative; if none, fails recipients. `increment_gateway_sent_count_atomic` returns false. | Set mock gateway `daily_limit` to 1 with 2 recipients |
| 5 | **CPU/wall-clock limit** — processor hits 10s timeout | `beforeunload` fires, saves partial `sent_count`/`failed_count`, leaves status `processing`. Cron picks up remaining recipients on next tick. | Send 200 recipients with `delayMs: 200` on mock |
| 6 | **Stop mid-flight** — user hits stop while processing | Campaign status set to `cancelled`. Processor's next `increment_sms_campaign_counts_atomic` rejects (terminal status guard). Remaining recipients stay `pending`. | Create campaign, immediately stop it |
| 7 | **Restart cancelled** — user restarts after stop | Status → `queued`, pending/skipped recipients reset to `pending`, processor re-triggered | Stop campaign, restart it |
| 8 | **Restart failed** — user restarts after failure | Same as restart cancelled | Wait for campaign to fail, restart |
| 9 | **Retry exhausted** — provider returns transient error (e.g., 429) | Up to 2 retries with exponential backoff (1s, 2s), then mark as failed | Configure mock to return 429 on first call, success on second |
| 10 | **Permanent error** — provider returns 401/403 | Gateway marked as failed immediately, no retry, no failover | Configure mock to return 401 |
| 11 | **Gateway failover** — assigned gateway fails, alternative available | Processor finds alternative via `findAlternativeGateway`, updates assignment, retries recipient | Two gateways, first one fails |
| 12 | **All gateways exhausted** — no gateway has capacity | All recipients get assigned to last gateway, then fail with "quota exceeded" | Set both gateways to `daily_limit: 0` (or exhaust them) |
| 13 | **Stale processing** — processor crashed mid-flight | Next processor run picks up campaign with status `processing` and `started_at > 10min ago`. Resets pending recipients and re-processes. | Simulate crash by stopping processor mid-flight, wait 10min+ |
| 14 | **Preview send** — test SMS to a phone number | Preview endpoint sends via first selected gateway, returns `{ sentToPhone, parts }` | Call preview with test phone number |

---

## 9. Manual Test Scenarios

### Scenario 1: Successful campaign (5 recipients)

| Field | Value |
|-------|-------|
| **Preconditions** | Gateway "test" reachable (mock running), 5 contacts have phones |
| **Trigger** | Create campaign via UI or curl POST to `/campaigns/create` with 5 recipients |
| **Curl example** | `curl -X POST $SUPABASE_URL/functions/v1/sms-campaigns/campaigns/create -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"senderName":"Test","messageTemplate":"Hello {{name}}","selectedRecipients":[{"phone":"+12002000000","personalization":{"name":"Charles"}},...],"fleetMode":true,"selectedGatewayIds":["71ddb94b-..."]}'` |
| **Mid-flight values** | Status `processing`, sent_count increments, gateway sent_today increments |
| **Expected final** | Status `completed`, sent_count=5, failed_count=0, gateway sent_today=5 |
| **Log signature** | `Campaign processing completed successfully` with `sentCount=5, failedCount=0` |
| **Cleanup** | Delete campaign via UI or DELETE endpoint |

### Scenario 2: Partial failure (mock fails 50%)

| Field | Value |
|-------|-------|
| **Preconditions** | Mock config set to `successRate: 0.5`, 10 recipients |
| **Trigger** | Update mock: `curl -X POST $MOCK_URL/config -d '{"successRate":0.5}'`. Then create campaign with 10 recipients |
| **Expected final** | Status `completed`, sent_count ≈5, failed_count ≈5 |
| **Log signature** | `Campaign completed with partial failures` |
| **Cleanup** | Reset mock: `curl -X POST $MOCK_URL/config -d '{"successRate":1.0}'` |

### Scenario 3: Full failure (all fail)

| Field | Value |
|-------|-------|
| **Preconditions** | Mock config set to `successRate: 0.0` |
| **Trigger** | Create campaign with 5 recipients |
| **Expected final** | Status `failed`, sent_count=0, failed_count=5 |
| **Log signature** | `Campaign processing completed successfully` with `sentCount=0, failedCount=5` |

### Scenario 4: Stop mid-flight

| Field | Value |
|-------|-------|
| **Preconditions** | Mock configured with `delayMs: 1000` per send, 10 recipients |
| **Trigger** | Create campaign. Immediately call POST `.../stop` |
| **Expected final** | Status `cancelled`. Sent_count may be 0 or partial depending on timing. Remaining recipients stay `pending`. |
| **Variant** | Verify stopped campaign cannot be re-processed (only restarted) |

### Scenario 5: Quota block

| Field | Value |
|-------|-------|
| **Preconditions** | Gateway daily_limit=1, sent_today=0 |
| **Trigger** | Create campaign with 3 recipients |
| **Expected** | First recipient sends (gateway sent_today → 1). Second recipient: gateway has no capacity, `increment_gateway_sent_count_atomic` returns false. If no alternative gateway, recipient fails with "Gateway quota exceeded". |
| **Cleanup** | Reset gateway sent_today: `UPDATE private.sms_fleet_gateways SET sent_today = 0` |

### Scenario 6: Restart after stop

| Field | Value |
|-------|-------|
| **Preconditions** | Campaign is in `cancelled` status (from Scenario 4) |
| **Trigger** | POST `.../restart` |
| **Expected** | Status → `queued`, pending/skipped recipients reset to `pending`, processor re-triggered. Campaign completes. |

### Scenario 7: Retry + permanent error

| Field | Value |
|-------|-------|
| **Preconditions** | Two separate campaigns: one with mock returning 429 (retryable), one with mock returning 401 |
| **Trigger** | Create campaign 1 (429): expected 2 retries with backoff, then succeed on 3rd. Create campaign 2 (401): expected immediate fail, no retry. |
| **Log signature for 401** | `Permanent gateway error, marking as failed` |

### Scenario 8: Gateway failover

| Field | Value |
|-------|-------|
| **Preconditions** | Two gateways: "gw1" (mock at localhost:9001) and "gw2" (mock at localhost:9002). gw1 configured to fail, gw2 succeeds. |
| **Trigger** | Create campaign with both gateways selected. Recipients assigned round-robin. gw1 recipients get permanent error → `findAlternativeGateway` reassigns to gw2. |
| **Expected** | All recipients eventually delivered via gw2. gw1 gets marked as failed. |

### Scenario 9: Stale recovery

| Field | Value |
|-------|-------|
| **Preconditions** | Campaign in `processing` status with `started_at` > 10 min ago |
| **Trigger** | Call POST `/process` (without campaignId) on `sms-campaigns-process` |
| **Expected** | Processor picks up stale campaign, resets pending recipients, re-processes |
| **Log signature** | `Recovering stale processing campaign` |

### Scenario 10: CPU limit (edge function wall clock)

| Field | Value |
|-------|-------|
| **Preconditions** | Mock with `delayMs: 200`, 200 recipients (total 40s, exceeds Supabase free tier 10s limit) |
| **Trigger** | Create campaign. Processor starts, hits 10s wall clock. `beforeunload` fires. |
| **Expected** | Partial `sent_count` saved. Campaign stays `processing`. Next cron tick or manual `/process` call resumes from remaining `pending` recipients. |
| **Log signature** | `Worker shutting down — saving partial campaign progress` |

### Scenario 11: SMSGate provider test

| Field | Value |
|-------|-------|
| **Preconditions** | SMSGate gateway configured with mock URL (`http://localhost:54321/functions/v1/sms-gateway-mock/smsgate/send-sms`), valid credentials |
| **Trigger** | Create campaign using SMSGate provider, send to 5 recipients |
| **Curl example** | `curl -X POST $SUPABASE_URL/functions/v1/sms-campaigns/campaigns/create -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"senderName":"Test","messageTemplate":"Hello {{name}}","selectedRecipients":[{"phone":"+12002000000","personalization":{"name":"Charles"}},...],"provider":"smsgate","fleetMode":true,"selectedGatewayIds":["gateway-id"]}'` |
| **Expected final** | Status `completed`, sent_count=5, failed_count=0. Messages stored with `provider: "smsgate"` |
| **Verify** | GET `/messages?provider=smsgate&campaignId=<id>` returns all 5 messages |
| **Cleanup** | DELETE campaign, clear messages via `DELETE /messages?campaignId=<id>` |

### Scenario 12: Message history API test

| Field | Value |
|-------|-------|
| **Preconditions** | At least 10 messages sent via mock (from any campaign) |
| **Trigger** | Query message history via GET `/messages` with various filters |
| **Test cases** | (1) `?limit=5` returns 5 most recent. (2) `?campaignId=X` returns only campaign X messages. (3) `?phone=+33612345678` returns only that phone. (4) `?full=true` with `X-Mock-Token` returns unmasked phone numbers. (5) `?offset=5&limit=5` returns paginated results. |
| **Expected** | Each filter returns correctly filtered subset. Default `full=false` redacts phones as `+336****5678`. |
| **Verify PII redaction** | `curl "http://localhost:54321/functions/v1/sms-gateway-mock/messages?limit=1"` — phone should be redacted |
| **Verify full data** | `curl "http://localhost:54321/functions/v1/sms-gateway-mock/messages?full=true" -H "X-Mock-Token: debug-token"` — phone should be full number |
| **Verify delete** | `DELETE /messages?campaignId=X` removes campaign messages. `DELETE /messages?all=true` with token clears all. |
| **Cleanup** | Clear test messages via DELETE endpoint |

### Scenario 13: Variable substitution verification via /messages

| Field | Value |
|-------|-------|
| **Preconditions** | Campaign sent with template `"Hello {{name}}, your code is {{code}}"`, recipients have personalization data |
| **Trigger** | Send campaign, then query `GET /messages?campaignId=<id>&full=true` |
| **Expected** | Each message shows the fully substituted text (e.g., `"Hello Charles, your code is ABC123"`), not the raw template |
| **Verify via API** | `curl "http://localhost:54321/functions/v1/sms-gateway-mock/messages?campaignId=<id>&full=true" -H "X-Mock-Token: debug-token"` |
| **Expected message text** | Recipients should have received personalized messages, not template placeholders |
| **Test with multiple variables** | Template with 3+ variables, verify all are substituted correctly per recipient |
| **Cleanup** | DELETE campaign, clear messages |

---

## 10. Open Questions / Assumptions

1. **What is the actual `dailyLimit` / `monthlyRecipientLimit` in production?** The test gateway has 200/200. The processor function `getSmsQuota()` reads from env vars (not from gateway limits for non-fleet mode). In fleet mode, gateway `daily_limit` is used.

2. **The mock gateway and the actual Simple SMS Gateway**: The mock implements `POST /send-sms` at a configurable endpoint. The production gateway also uses `POST /send-sms`. When testing with the mock, the gateway's `config.simpleSmsGatewayBaseUrl` must point to the mock's URL (e.g., `http://localhost:54321/functions/v1/sms-gateway-mock`).

3. **How does the frontend refresh after gateway quota changes?** After campaign creation, there's a `setTimeout(8000)` refresh. During processing, the 60s polling catches changes. There's no websocket/push mechanism — users might see stale quota for up to 60s.

4. **`increment_gateway_sent_count_atomic` only checks `daily_limit`**, not `monthly_limit`. The monthly limit is checked at campaign creation time (`checkSmsQuota()`), not per-send. A campaign could theoretically exceed the monthly limit if it's large enough.

5. **The `beforeunload` save is best-effort** — it uses `EdgeRuntime.waitUntil` which has a limited grace period. If the DB update doesn't complete in time, partial progress is lost.

6. **What happens with `channel = 'whatsapp'`?** The `sms_campaigns.channel` column allows `whatsapp` values but the current codebase only sets `channel = 'sms'`. The frontend campaign list filters by channel.

7. **No DELETE CASCADE on `sms_campaign_unsubscribes`** for campaign FK — uses `ON DELETE SET NULL`. This means unsubscribes survive campaign deletion, which is correct for compliance.

8. **No test for the Twilio provider fallback** — Twilio requires env variables `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. The mock covers `simple-sms-gateway` only.

---

## Phase 1 Results Summary

### A. Reset Confirmation

| Table | Before | After |
|-------|--------|-------|
| `sms_campaigns` | 1 | **0** ✓ |
| `sms_campaign_recipients` | 115 | **0** ✓ |
| `sms_campaign_recipient_gateways` | 115 | **0** ✓ |
| `sms_campaign_link_clicks` | — | **0** ✓ |
| `sms_campaign_unsubscribes` | — | **0** ✓ |
| `sms_fleet_gateways.sent_today` | 115 | **0** ✓ |

### B. Inventory

- **200 contacts with telephones** for user `346eee1b-...` — sufficient for testing all scenarios
- **1 gateway** (`test`, `simple-sms-gateway`) with daily_limit=200, monthly_limit=200
- No synthetic contacts needed

### C. File Path to Test Plan

`docs/testing/sms-campaign-test-plan.md`

### D. Surprising Findings

1. **`sms_campaign_recipient_clicks` and `sms_campaign_recipient_unsubscribes` do not exist** — the original reset SQL referenced tables that were never created. Clicks are stored in `sms_campaign_link_clicks` (campaign+recipient scoped), and unsubscribes in `sms_campaign_unsubscribes` (user+phone scoped, NOT recipient-scoped).

2. **Dual `get_sms_campaigns_overview` in both `private` and `public` schemas** — the frontend calls `private.get_sms_campaigns_overview()` via `$supabase.schema('private').rpc()`, but there's also a `public.get_sms_campaigns_overview` copy. They have different argument signatures (public takes `user_id` param, private uses `auth.uid()`).

3. **`increment_sms_campaign_counts_atomic` uses `FOR UPDATE` row lock** but `increment_gateway_sent_count_atomic` does the same — both are properly atomic. However, `batch_increment_gateway_counts` and `increment_gateway_sent_count` exist as non-atomic alternatives that are NOT quota-guarded.

4. **The `trigger_sms_campaign_processor` DB function** is a `SECURITY DEFINER` function that reads from `vault.decrypted_secrets` and calls `net.http_post`. This means a DB trigger on campaign insert directly calls the processor edge function — but the immediate trigger from the edge function itself (`triggerSmsCampaignProcessorFromEdge`) is the primary path. The DB trigger is a fallback.

5. **Gateway selection in `SmsCampaignComposerDialog.vue`** requires at least one gateway selected, but the `isActionDisabled` check also verifies `selectedContactsLength > 0` AND `!exceedsMonthlyRecipientLimit` AND `isFormValid`. The monthly limit defaults to 200 and cannot exceed 200 per the `InputNumber` max.

### E. Phase 2 Can Proceed

- **Target campaign row count**: 1 new campaign (10–50 recipients for happy path)
- **Target recipient count**: 10 (for quick happy-path verification) up to 50 (for partial-failure scenarios)
- **Target gateway**: `test` (id: `71ddb94b-5a2b-4c21-9fb4-6b4c4e5fcde5`, provider: `simple-sms-gateway`, pointing to the mock endpoint)
