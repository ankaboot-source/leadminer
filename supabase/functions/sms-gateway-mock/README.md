# SMS Gateway Mock Server

A mock implementation of the Simple SMS Gateway Android app API for testing SMS campaign delivery/progress logic.

## Quick Start

```bash
cd supabase/functions/sms-gateway-mock
deno run --allow-all index.ts
```

The server starts on port 8000 by default (configurable via `PORT` env var).

## API Endpoints

### GET /health

Health check endpoint.

```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "ok",
  "service": "sms-gateway-mock",
  "config": {
    "successRate": 1.0,
    "delayMs": 0
  }
}
```

### POST /send-sms

Send an SMS message (mocked).

**Request:**
```bash
curl -X POST http://localhost:8000/send-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"+33612345678","message":"Hello"}'
```

**Success Response (HTTP 200):**
```json
{
  "id": "mock_1",
  "messageId": "mock_1"
}
```

**Error Response (HTTP 4xx/5xx):**
```json
{
  "message": "Mock gateway error"
}
```

### POST /config

Update mock server configuration at runtime.

```bash
curl -X POST http://localhost:8000/config \
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

To test SMS campaigns against the mock server, set the fleet gateway `simpleSmsGatewayBaseUrl` to:

```
http://localhost:8000
```

## Testing Different Scenarios

### Test 80% success rate with 100ms delay:
```bash
curl -X POST http://localhost:8000/config \
  -H "Content-Type: application/json" \
  -d '{"successRate":0.8,"delayMs":100}'
```

### Test all requests failing with 400 status:
```bash
curl -X POST http://localhost:8000/config \
  -H "Content-Type: application/json" \
  -d '{"successRate":0.0,"failStatusCode":400,"failMessage":"Gateway busy"}'
```

### Test with random UUIDs instead of sequential IDs:
```bash
curl -X POST http://localhost:8000/config \
  -H "Content-Type: application/json" \
  -d '{"sequentialId":false}'
```

## Environment Variables

| Variable | Default | Description              |
|----------|---------|--------------------------|
| `PORT`   | `8000`  | Server port              |
| `LOG_LEVEL` | `info` | Log level (debug/info/warn/error) |