# SMS Gateway Mock - Testing Guide

## Overview

The mock SMS gateway simulates the Simple SMS Gateway Android app API for testing SMS campaign delivery/progress logic without needing a real phone.

## Deployment

The mock is deployed as a Supabase edge function at:
```
http://localhost:54321/functions/v1/sms-gateway-mock
```

It's automatically available when running `npm run dev:supabase`.

## API Endpoints

### GET /health
Returns the current mock configuration.

### POST /send-sms
Simulates sending an SMS. Returns success or failure based on configuration.

**Request:**
```json
{"phone": "+33612345678", "message": "Hello"}
```

**Success Response (HTTP 200):**
```json
{"id": "mock_1", "messageId": "mock_1", "success": true}
```

**Error Response (HTTP 4xx/5xx):**
```json
{"message": "Mock gateway error", "success": false}
```

### POST /config
Update mock behavior at runtime.

## Configuration Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `successRate` | number | 1.0 | Probability of success (0.0-1.0) |
| `delayMs` | number | 0 | Artificial delay in milliseconds |
| `failMessage` | string | "Mock gateway error" | Error message on failure |
| `failStatusCode` | number | 500 | HTTP status code for failures |
| `sequentialId` | boolean | true | Use sequential IDs (mock_1, mock_2) |
| `idPrefix` | string | "mock_" | Prefix for generated message IDs |

## Testing Scenarios

### Scenario 1: Happy Path
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"successRate":1.0}'
```

### Scenario 2: All Failures
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"successRate":0.0,"failMessage":"quota exceeded"}'
```

### Scenario 3: Partial Failures
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"successRate":0.5}'
```

### Scenario 4: Timeout
```bash
curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
  -H "Content-Type: application/json" \
  -d '{"delayMs":20000}'
```

## Frontend Testing

### Setup

1. Start local Supabase:
   ```bash
   npm run dev:supabase
   ```

2. Start frontend:
   ```bash
   cd frontend && npm run dev
   ```

3. Create a mock fleet gateway in the UI:
   - Go to **Sources → SMS Gateways → Add Gateway**
   - Name: `Mock Gateway`
   - Provider: `Simple SMS Gateway`
   - Gateway URL: `http://localhost:54321/functions/v1/sms-gateway-mock/send-sms`
   - Daily Limit: `100`

4. Configure mock behavior (optional):
   ```bash
   curl -X POST http://localhost:54321/functions/v1/sms-gateway-mock/config \
     -H "Content-Type: application/json" \
     -d '{"successRate":0.8,"delayMs":200}'
   ```

5. Create and send a campaign:
   - Select contacts with phone numbers
   - Choose fleet mode
   - Select the Mock Gateway
   - Write a message with `{{name}}` placeholder
   - Send

6. Watch the logs:
   ```bash
   docker logs --tail 50 -f supabase_edge_runtime_leadminer
   ```

7. Check campaign progress in the UI:
   - Campaign list shows delivery progress
   - `X/Y sent` with partial failure indicator if applicable

## Troubleshooting

### "Gateway unreachable" when creating gateway
- Make sure Supabase is running: `docker ps | grep supabase`
- Test the mock directly: `curl http://localhost:54321/functions/v1/sms-gateway-mock/health`

### Campaign says "processing" forever
- Check edge runtime logs: `docker logs --tail 50 supabase_edge_runtime_leadminer`
- Verify the mock is responding: `curl http://localhost:54321/functions/v1/sms-gateway-mock/health`

### "Unexpected non-whitespace character after JSON" error
- The fleet gateway URL is wrong. It must include `/send-sms` at the end.
- Correct: `http://localhost:54321/functions/v1/sms-gateway-mock/send-sms`
- Wrong: `http://localhost:54321/functions/v1/sms-gateway-mock`

### "No valid phone numbers" error
- Make sure contacts have `telephone` field populated
- Phone numbers must be in E.164 format (+country code)

## Test Coverage

| Component | Tests | Coverage |
|-----------|-------|----------|
| Mock server | 8 | Request validation, success/failure, config updates |
| Provider | 3 | Send, error handling, timeout |
| Integration | 5 | Success, failure, retries, partial failures, timeout |

## Known Limitations

- Integration tests test the **provider**, not the full campaign processor loop
- Template rendering, click trackers, and gateway failover are tested manually via the frontend
- For full processor testing, use the mock server with a real campaign send