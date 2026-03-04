# Refactoring Plan: fetch-mining-source Edge Function

## Overview

Refactor the `fetch-mining-source` edge function to have cleaner code structure, simplified authorization logic, and proper validation using Zod.

## Current Issues

### 1. Over-Complicated Mode Logic

The current implementation uses a `mode` variable ("user" | "service") that makes the code harder to follow:

```typescript
let mode: "user" | "service" = "user";
// ... complex logic to determine mode ...
if (mode === "service") { ... } else { ... }
```

### 2. No Request Validation

Body validation is manual and scattered:

```typescript
const body = await req.json();
targetEmail = body.email;
userId = body.user_id;
// Manual validation checks throughout...
```

### 3. Inconsistent Client Usage

The code mixes admin and user client usage:

- Uses different RPC calls based on mode (`get_mining_source_credentials_for_user` vs `get_user_mining_source_credentials`)
- Creates confusion about which client to use when

### 4. Poor Code Organization

Everything is in one large handler function (240+ lines), making it hard to test and maintain.

## Proposed Solution

### 1. Simplified Authorization Logic

**Remove the `mode` concept entirely.**

Instead:

- **Always** use admin client for database operations (RPC calls)
- Determine `user_id` from two sources (in priority order):
  1. If authorization header contains a **valid user JWT** → extract `user.id` from `supabase.auth.getUser()`
  2. If authorization header is the **service role key** → get `user_id` from request body

This simplifies the flow:

```typescript
const userId = await this.resolveUserId(authorization, body.userId);
// Then always use admin client for DB operations
const sources = await this.fetchSourcesWithAdmin(userId);
```

### 2. Zod Schema Validation

Define a clear schema for the request body:

```typescript
const RequestSchema = z.object({
  email: z.string().optional(), // Filter by specific email or "all"
  user_id: z.string().uuid().optional(), // Required only for service calls
});

type RequestBody = z.infer<typeof RequestSchema>;
```

### 3. Class-Based Structure

Create a `FetchMiningSourceHandler` class with clear responsibilities:

```typescript
class FetchMiningSourceHandler {
  private admin: SupabaseClient;
  private logger: Logger;
  private encryptionKey: string;

  // Main entry point
  async handle(req: Request): Promise<Response>;

  // Private methods for specific concerns
  private validateEnvironment(): void;
  private async parseAndValidateBody(req: Request): Promise<RequestBody>;
  private async resolveUserId(
    authHeader: string | null,
    bodyUserId?: string,
  ): Promise<string>;
  private async fetchSources(userId: string): Promise<MiningSource[]>;
  private async refreshTokensIfNeeded(
    sources: MiningSource[],
    userId: string,
  ): Promise<string[]>;
  private buildResponse(
    sources: MiningSource[],
    refreshedEmails: string[],
  ): Response;
}
```

### 4. Consistent Database Access

Always use the admin client with `get_mining_source_credentials_for_user` RPC:

```typescript
const { data, error } = await this.admin
  .schema("private")
  .rpc("get_mining_source_credentials_for_user", {
    _user_id: userId,
    _encryption_key: this.encryptionKey,
  });
```

### 5. Improved Error Handling

- Use structured error responses
- Proper logging with context
- Clear separation of auth errors vs business logic errors

## Implementation Steps

### Step 1: Update deno.json

Add Zod dependency:

```json
{
  "imports": {
    "simple-oauth2": "npm:simple-oauth2@latest",
    "zod": "https://deno.land/x/zod@v3.23.8/mod.ts"
  }
}
```

### Step 2: Create Refactored index.ts

Replace the monolithic handler with the class-based implementation:

Key changes:

1. Remove unused import (`expiresAt` from auth-js)
2. Add Zod schema definition
3. Implement `FetchMiningSourceHandler` class
4. Keep all existing functionality (token refresh, filtering, etc.)
5. Simplified `Deno.serve()` entry point

### Step 3: Code Structure

```typescript
// Constants and Schema
const REFRESH_BUFFER_MS = 1000;

const RequestSchema = z.object({
  email: z.string().optional(),
  user_id: z.string().uuid().optional(),
});

// Error classes for better error handling
class AuthError extends Error { ... }
class ValidationError extends Error { ... }

// Main handler class
class FetchMiningSourceHandler { ... }

// Entry point
Deno.serve(async (req) => {
  const handler = new FetchMiningSourceHandler();
  return handler.handle(req);
});
```

## Benefits

1. **Simpler Logic**: No more `mode` variable, clear flow from auth → validation → processing
2. **Type Safety**: Zod ensures request body is valid before processing
3. **Testability**: Class methods can be unit tested independently
4. **Maintainability**: Clear separation of concerns, each method has a single responsibility
5. **Consistency**: Always uses admin client for DB, auth only for user verification
6. **Security**: Service key check uses timing-safe comparison

## Backward Compatibility

The refactored code maintains full backward compatibility:

- Same request/response format
- Same environment variables
- Same RPC calls
- Same token refresh behavior
- Existing clients (like email-campaigns) will work without changes

## Testing Considerations

1. Unit tests for `FetchMiningSourceHandler` methods
2. Integration tests for the full flow
3. Test both user JWT and service key authentication paths
4. Test validation edge cases (invalid email, missing user_id for service calls, etc.)

## Migration Path

1. Create new branch: `refactor/fetch-mining-source`
2. Implement refactored code
3. Run existing tests to ensure no regressions
4. Manual testing with both user and service authentication
5. Deploy to staging
6. Monitor for any issues
7. Merge to main

## Example Usage (unchanged)

**User call:**

```bash
curl -X POST $SUPABASE_URL/functions/v1/fetch-mining-source \
  -H "Authorization: Bearer $USER_JWT" \
  -d '{"email": "all"}'
```

**Service call:**

```bash
curl -X POST $SUPABASE_URL/functions/v1/fetch-mining-source \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -d '{"email": "all", "user_id": "uuid-here"}'
```

Both will continue to work exactly as before.
