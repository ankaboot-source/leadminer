# SMS Gateway Mock Server

A mock implementation of the Simple SMS Gateway Android app API for testing SMS campaign delivery/progress logic.

## Quick Start

The mock server is deployed as a Supabase edge function. It's automatically available when you run `npm run dev:supabase`.

### Test the mock directly

```bash
# Health check
curl http://localhost:54321/functions/v1/sms-gateway-mock/health

# Send a test SMS
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/send-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"+33612345678","message":"Hello"}'
```

### Configure the mock behavior

```bash
# 80% success rate, 100ms delay
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"successRate":0.8,"delayMs":100}'
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
    "idPrefix": "mock_"
  }
}
```

### POST /send-sms

Send an SMS message (mocked).

**Request:**
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/send-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"+33612345678","message":"Hello"}'
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

### POST /config

Update mock server configuration at runtime.

```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"successRate":0.8,"delayMs":100}'
```

**Configuration Options:**

| Field           | Type    | Default       | Description                           |
|-----------------|---------|---------------|---------------------------------------|
| `successRate`   | number  | `1.0`         | Probability of success (0.0-1.0)       |
| `delayMs`       | number  | `0`           | Artificial delay in milliseconds      |
| `failMessage`   | string  | `"Mock gateway error"` | Error message on failure     |
| `failStatusCode`| number  | `500`         | HTTP status code for failures         |
| `sequentialId`  | boolean | `true`        | Use sequential IDs (`mock_1`, `mock_2`) |
| `idPrefix`      | string  | `"mock_"`     | Prefix for generated message IDs      |

## Integration with Campaigns

To test SMS campaigns against the mock server, set the fleet gateway URL to:

```
http://localhost:54321/functions/v1/sms-gateway-mock/send-sms
```

**Important**: The `SimpleSmsGatewayProvider` POSTs to the `baseUrl` directly (it does NOT append `/send-sms`). The URL must include the full path including `/send-sms`.

### Frontend Testing Workflow

1. Start local Supabase: `npm run dev:supabase`
2. Start frontend: `cd frontend && npm run dev`
3. In the frontend, go to **Sources → SMS Gateways → Add Gateway**:
   - Name: `Mock Gateway`
   - Provider: `Simple SMS Gateway`
   - Gateway URL: `http://localhost:54321/functions/v1/sms-gateway-mock/send-sms`
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

### Test with random UUIDs instead of sequential IDs:
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"sequentialId":false}'
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

| Variable   | Default | Description                          |
|------------|---------|--------------------------------------|
| `LOG_LEVEL` | `info`  | Log level (debug/info/warn/error)    |