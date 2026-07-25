# SMS Gateway Mock Server

A mock implementation of the SMS Gateway API for testing SMS campaign delivery/progress logic. Supports multiple providers: `simple-sms-gateway` and `smsgate`.

## Quick Start

The mock server is deployed as a Supabase edge function. It's automatically available when you run `npm run dev:supabase`.

### Test the mock directly

```bash
# Health check
curl http://localhost:54321/functions/v1/sms-gateway-mock/health

# Send a test SMS via simple-sms-gateway provider
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/simple-sms-gateway/send-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"+33612345678","message":"Hello"}'

# Send a test SMS via smsgate provider (Basic Auth required)
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/smsgate/send-sms \
  -H "Content-Type: application/json" \
  -u "username:password" \
  -d '{"textMessage":{"text":"Hello"},"phoneNumbers":["+33612345678"]}'
```

### Configure the mock behavior

```bash
# Global config: 80% success rate, 100ms delay
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"successRate":0.8,"delayMs":100}'

# Per-provider override: smsgate fails 100%
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"provider":"smsgate","successRate":0.0}'
```

## Multi-Provider Architecture

The mock server routes requests to provider-specific handlers based on the URL path:

| Provider | Endpoint | Auth | Request Format |
|----------|----------|------|----------------|
| `simple-sms-gateway` | `/:provider/send-sms` | None | `{ phone, message }` |
| `smsgate` | `/:provider/send-sms` | Basic Auth | `{ textMessage: { text }, phoneNumbers: [phone] }` |

### Simple SMS Gateway Provider

Used by `SimpleSmsGatewayProvider`. No authentication required.

**Request:**
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/simple-sms-gateway/send-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"+33612345678","message":"Hello {{name}}"}'
```

**Success Response (HTTP 200):**
```json
{
  "id": "mock_1",
  "messageId": "mock_1",
  "success": true
}
```

**Error Response (HTTP 4xx/5xx):**
```json
{
  "message": "Mock gateway error",
  "success": false
}
```

### SMSGate Provider

Used by `SmsgateProvider`. Requires Basic Auth (username:password).

**Request:**
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/smsgate/send-sms \
  -H "Content-Type: application/json" \
  -u "myuser:mypassword" \
  -d '{"textMessage":{"text":"Hello {{name}}"},"phoneNumbers":["+33612345678"]}'
```

**Success Response (HTTP 200):**
```json
{
  "id": "mock_1",
  "messageId": "mock_1",
  "success": true
}
```

**Error Response (HTTP 4xx/5xx):**
```json
{
  "message": "Mock gateway error",
  "success": false
}
```

## API Endpoints

### GET /health

Health check endpoint.

```bash
curl http://localhost:54321/functions/v1/sms-gateway-mock/health
```

Response:
```json
{
  "status": "ok",
  "service": "sms-gateway-mock",
  "config": {
    "successRate": 1.0,
    "delayMs": 0,
    "failMessage": "Mock gateway error",
    "failStatusCode": 500,
    "sequentialId": true,
    "idPrefix": "mock_",
    "providerConfig": {}
  }
}
```

### POST /:provider/send-sms

Send an SMS message via the specified provider. Provider can be `simple-sms-gateway` or `smsgate`.

**Simple SMS Gateway Request:**
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/simple-sms-gateway/send-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"+33612345678","message":"Hello"}'
```

**SMSGate Request:**
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/smsgate/send-sms \
  -H "Content-Type: application/json" \
  -u "username:password" \
  -d '{"textMessage":{"text":"Hello"},"phoneNumbers":["+33612345678"]}'
```

**Success Response (HTTP 200):**
```json
{
  "id": "mock_1",
  "messageId": "mock_1",
  "success": true
}
```

**Error Response (HTTP 4xx/5xx):**
```json
{
  "message": "Mock gateway error",
  "success": false
}
```

### GET /messages

Retrieve stored message history with optional filtering.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `campaignId` | string | — | Filter by campaign ID |
| `provider` | string | — | Filter by provider (`simple-sms-gateway`, `smsgate`) |
| `phone` | string | — | Filter by phone number |
| `limit` | number | `50` | Max results (max 1000) |
| `offset` | number | `0` | Pagination offset |
| `full` | boolean | `false` | Set `true` to include PII (requires `X-Mock-Token` header) |

**Example:**
```bash
# Get last 10 messages
curl "http://localhost:54321/functions/v1/sms-gateway-mock/messages?limit=10"

# Get messages for specific campaign
curl "http://localhost:54321/functions/v1/sms-gateway-mock/messages?campaignId=test-campaign&limit=50"

# Get full message data (includes phone numbers)
curl "http://localhost:54321/functions/v1/sms-gateway-mock/messages?full=true&limit=10" \
  -H "X-Mock-Token: <your-mock-token>"
```

**Response:**
```json
{
  "messages": [
    {
      "id": "mock_1",
      "campaignId": "test-campaign",
      "provider": "smsgate",
      "phone": "+33612345678",
      "text": "Hello",
      "status": "sent",
      "createdAt": "2026-07-24T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

**PII Redaction:** By default, phone numbers are redacted in responses (e.g., `+336****5678`). Use the `X-Mock-Token: <your-mock-token>` header with `full=true` to retrieve unmasked data.

### DELETE /messages

Clear message history. Supports the same filtering as GET `/messages`.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `campaignId` | string | Delete messages for specific campaign |
| `provider` | string | Delete messages for specific provider |
| `phone` | string | Delete messages for specific phone |
| `all` | boolean | Set `true` to clear all messages (requires `X-Mock-Token`) |

**Example:**
```bash
# Delete messages for specific campaign
curl -X DELETE "http://localhost:54321/functions/v1/sms-gateway-mock/messages?campaignId=test-campaign"

# Clear all messages (requires auth token)
curl -X DELETE "http://localhost:54321/functions/v1/sms-gateway-mock/messages?all=true" \
  -H "X-Mock-Token: <your-mock-token>"
```

**Response:**
```json
{
  "success": true,
  "deleted": 5
}
```

### POST /config

Update mock server configuration at runtime.

```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"successRate":0.8,"delayMs":100}'
```

**Configuration Options:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `successRate` | number | `1.0` | Probability of success (0.0-1.0) |
| `delayMs` | number | `0` | Artificial delay in milliseconds |
| `failMessage` | string | `"Mock gateway error"` | Error message on failure |
| `failStatusCode` | number | `500` | HTTP status code for failures |
| `sequentialId` | boolean | `true` | Use sequential IDs (`mock_1`, `mock_2`) |
| `idPrefix` | string | `"mock_"` | Prefix for generated message IDs |
| `provider` | string | — | Apply config to specific provider only |

**Per-Provider Config Example:**
```bash
# Configure smsgate to fail 100%
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"provider":"smsgate","successRate":0.0,"failMessage":"SMSGate unavailable"}'

# Configure simple-sms-gateway with 50% success rate
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"provider":"simple-sms-gateway","successRate":0.5}'
```

## Production Guard

The mock server will only respond when `NODE_ENV` is not `production`. In production deployments, all mock endpoints return `403 Forbidden`:

```json
{
  "error": "SMS gateway mock is disabled in production"
}
```

This prevents accidental test traffic to production systems.

## Integration with Campaigns

To test SMS campaigns against the mock server, configure the fleet gateway URL to the mock endpoint:

### Simple SMS Gateway

```
http://localhost:54321/functions/v1/sms-gateway-mock/simple-sms-gateway/send-sms
```

**Important**: The `SimpleSmsGatewayProvider` POSTs to the `baseUrl` directly (it does NOT append `/send-sms`). The URL must include the full path including `/send-sms`.

### SMSGate

```
http://localhost:54321/functions/v1/sms-gateway-mock/smsgate/send-sms
```

The `SmsgateProvider` handles Basic Auth internally based on the gateway credentials.

### Frontend Testing Workflow

1. Start local Supabase: `npm run dev:supabase`
2. Start frontend: `cd frontend && npm run dev`
3. In the frontend, go to **Sources → SMS Gateways → Add Gateway**:
   - Name: `Mock SMSGate`
   - Provider: `SMSGate`
   - Gateway URL: `http://localhost:54321/functions/v1/sms-gateway-mock/smsgate/send-sms`
   - Username: `testuser`
   - Password: `testpass`
   - Daily Limit: `100`
4. Create a campaign with contacts that have phone numbers
5. Select the Mock Gateway and send
6. Watch the mock server logs in the edge runtime: `docker logs --tail 50 supabase_edge_runtime_leadminer`

## Testing Different Scenarios

### Test 80% success rate with 100ms delay:
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"successRate":0.8,"delayMs":100}'
```

### Test all requests failing with 400 status:
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"successRate":0.0,"failStatusCode":400,"failMessage":"Gateway busy"}'
```

### Test SMSGate provider specifically failing:
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"provider":"smsgate","successRate":0.0}'
```

### Test with random UUIDs instead of sequential IDs:
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"sequentialId":false}'
```

### Verify message history:
```bash
# List recent messages
curl "http://localhost:54321/functions/v1/sms-gateway-mock/messages?limit=20"

# Filter by campaign
curl "http://localhost:54321/functions/v1/sms-gateway-mock/messages?campaignId=my-campaign-id"

# Get full data (unredacted)
curl "http://localhost:54321/functions/v1/sms-gateway-mock/messages?full=true" \
  -H "X-Mock-Token: <your-mock-token>"
```

## Programmatic Use

```typescript
import { createMockServer, resetMockServer } from "./index.ts";

// Create server instance for testing
const app = createMockServer();

// Reset state between tests
resetMockServer();
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Log level (debug/info/warn/error) |
| `NODE_ENV` | `development` | Environment (production guard) |