# Billing Edge Function

Handles credit validation and charging for leadminer features in edge functions.

## Overview

This edge function provides billing capabilities for Supabase Edge Functions, mirroring the backend billing plugin functionality. It's designed to work alongside the existing backend billing system during the transition period.

## Architecture

```
billing/
├── index.ts              # Main entry point, route registration
├── deno.json             # Deno configuration
├── README.md             # This documentation
├── handlers/             # Feature-specific billing handlers
│   ├── campaign.ts       # Campaign billing (charge/quota)
│   └── mod.ts            # Handler exports
└── shared/               # Shared billing module
    ├── billing-manager.ts # Core billing logic
    ├── types.ts          # TypeScript types
    └── mod.ts            # Module exports
```

## Current System State

**Edge Function Billing (NEW):**

- Campaigns: ✅ Handled by edge function
- Export (CSV/VCARD): 🔜 Future - backend still handles
- Enrichment: 🔜 Future - backend still handles
- Auth cleanup: 🔜 Future - backend still handles

**Backend Billing (EXISTING - kept intact):**

- Export (CSV/VCARD): ✅ Backend handles
- Enrichment: ✅ Backend handles
- Auth cleanup (deleteCustomer): ✅ Backend handles

## Endpoints

All endpoints require:

- `Authorization: Bearer <SERVICE_ROLE_KEY>` header
- `ENABLE_CREDIT=true` environment variable

### Campaign Billing

#### POST /billing/campaign/quota

Validate credits without charging.

**Request:**

```json
{
  "userId": "uuid",
  "units": 100
}
```

**Response (200):**

```json
{
  "hasCredits": true,
  "available": 500,
  "requested": 100
}
```

#### POST /billing/campaign/charge

Charge credits for campaign.

**Request:**

```json
{
  "userId": "uuid",
  "units": 100,
  "partialCampaign": false
}
```

**Response (200) - Success:**

```json
{
  "total": 100,
  "available": 100,
  "chargedUnits": 100,
  "partialCampaign": false
}
```

**Response (266) - Partial/Confirmation needed:**

```json
{
  "total": 100,
  "available": 50,
  "chargedUnits": 50,
  "partialCampaign": true,
  "reason": "credits"
}
```

**Response (402) - Insufficient credits:**

```json
{
  "total": 100,
  "available": 0,
  "reason": "credits"
}
```

## Adding New Billing Features

To add billing for a new feature:

1. Create handler in `handlers/<feature>.ts`:

```typescript
export async function handleFeatureCharge(c: Context): Promise<Response> {
  const { userId, units } = await c.req.json();

  const result = await billingManager.chargeCredits({
    userId,
    units,
    feature: "feature-name",
    partialAllowed: false,
  });

  return c.json(result.payload, result.status);
}

export async function handleFeatureQuota(c: Context): Promise<Response> {
  const { userId, units } = await c.req.json();

  const result = await billingManager.checkQuota({
    userId,
    units,
    feature: "feature-name",
  });

  return c.json({
    hasCredits: result.hasCredits,
    available: result.availableUnits,
    requested: result.requestedUnits,
  });
}
```

2. Export from `handlers/mod.ts`:

```typescript
export { handleFeatureCharge, handleFeatureQuota } from "./feature.ts";
```

3. Register routes in `index.ts`:

```typescript
app.post("/feature/charge", handleFeatureCharge);
app.post("/feature/quota", handleFeatureQuota);
```

## Environment Variables

- `ENABLE_CREDIT` - Enable billing (set to "true")
- `SUPABASE_SERVICE_ROLE_KEY` - For authentication
- `SUPABASE_URL` - Supabase instance URL
- `SUPABASE_ANON_KEY` - Supabase anon key

## Testing Locally

```bash
# Start Supabase
npm run dev:supabase

# Serve functions
npm run dev:supabase-functions

# Test quota endpoint (validate only)
curl -X POST http://localhost:54321/functions/v1/billing/campaign/quota \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-uuid", "units": 100}'

# Test charge endpoint (with credits)
curl -X POST http://localhost:54321/functions/v1/billing/campaign/charge \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-uuid", "units": 50}'
```

## Migration Notes

### Backend Billing (keep intact)

The following backend files remain unchanged and continue to work:

- `backend/src/controllers/contacts.controller.ts` - Export billing
- `backend/src/controllers/enrichment.controller.ts` - Enrichment billing
- `backend/src/controllers/enrichment.helpers.ts` - Enrichment helpers
- `backend/src/controllers/auth.controller.ts` - Account cleanup
- `backend/src/app.ts` - Billing router registration

### Future Migrations

When ready to migrate more features to edge functions:

1. Create handler in `billing/handlers/`
2. Add routes in `billing/index.ts`
3. Update calling code to use edge function instead of backend
4. Eventually remove from backend once fully migrated

## Shared Billing Manager

The `billingManager` singleton provides:

- `checkQuota(input)` - Validate credits without charging
- `chargeCredits(input)` - Charge credits with partial support
- `deleteCustomer(userId)` - Placeholder for account cleanup (future use)

All methods interact directly with the `profiles` table in Supabase.
