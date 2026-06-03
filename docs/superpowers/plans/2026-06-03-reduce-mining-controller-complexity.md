# Reduce Mining Controller Cyclomatic Complexity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce cyclomatic complexity of `startMining` from 26 to <15 by extracting Google Contacts logic and error handling into helper functions.

**Architecture:** The `startMining` method in `mining.controller.ts` does too much: credential validation + Google Contacts token resolution + pipeline submission + multi-branch error handling. Extract the Google Contacts resolution into a standalone function and extract the multi-branch catch block into a structured error handler.

**Tech Stack:** TypeScript, Express

---

### Task 1: Extract Google Contacts Credentials Resolution

**Files:**
- Modify: `backend/src/controllers/mining.controller.ts:251-293`
- No new file — extract inline into same controller file

**Analysis:** Lines 251-293 handle resolving Google Contacts credentials (query all sources, find google source by email, check for refreshToken, construct credentials object, error if missing). This is a self-contained concern — extract it to a function that returns credentials or null.

- [ ] **Step 1: Add helper function above `startMining`**

Insert before the `startMining` method:

```typescript
async function resolveGoogleContactsCredentials(
  userId: string,
  email: string,
  googleContactsSync?: boolean
): Promise<{ accessToken: string; refreshToken: string; userEmail: string } | null> {
  if (!googleContactsSync) {
    return null;
  }

  const allSources = await miningSourceService.getSourcesForUser(userId);
  const googleSource =
    allSources.find((s) => s.type === 'google' && s.email === email) ||
    allSources.find((s) => s.type === 'google');

  if (
    !googleSource?.credentials ||
    !('accessToken' in googleSource.credentials)
  ) {
    logger.warn('Google Contacts sync requested but no credentials found', {
      userId,
      email
    });
    return null;
  }

  const oauthCreds = googleSource.credentials;
  const { accessToken, refreshToken } = oauthCreds;

  if (!refreshToken) {
    logger.warn(
      'Google source missing refreshToken, re-authenticating may be needed',
      {
        userId,
        email: googleSource.email
      }
    );
  }

  return {
    accessToken,
    refreshToken: refreshToken ?? '',
    userEmail: googleSource.email
  };
}
```

Note: This uses `logger` and `miningSourceService` which are already available at module scope.

- [ ] **Step 2: Replace inline Google Contacts logic in `startMining`**

Replace lines 251-293:

Current:
```typescript
      let googleContactsCredentials;
      if (googleContactsSync) {
        const allSources = await miningSourceService.getSourcesForUser(user.id);
        const googleSource =
          allSources.find(
            (s) => s.type === 'google' && s.email === sanitizedEmail
          ) || allSources.find((s) => s.type === 'google');
        if (
          googleSource?.credentials &&
          'accessToken' in googleSource.credentials
        ) {
          const oauthCreds = googleSource.credentials;
          const { accessToken, refreshToken } = oauthCreds;

          if (!refreshToken) {
            logger.warn(
              'Google source missing refreshToken, re-authenticating may be needed',
              {
                userId: user.id,
                email: googleSource.email
              }
            );
          }

          googleContactsCredentials = {
            accessToken,
            refreshToken: refreshToken ?? '',
            userEmail: googleSource.email
          };
        }
      }

      if (googleContactsSync && !googleContactsCredentials) {
        logger.warn('Google Contacts sync requested but no credentials found', {
          userId: user.id,
          email: sanitizedEmail
        });
        return res.status(403).json({
          error:
            'Google Contacts: OAuth permissions not granted. Please re-authenticate with Contacts permission.',
          type: 'google'
        });
      }
```

Replace with:
```typescript
      const googleContactsCredentials =
        await resolveGoogleContactsCredentials(
          user.id,
          sanitizedEmail,
          googleContactsSync
        );

      if (googleContactsSync && !googleContactsCredentials) {
        return res.status(403).json({
          error:
            'Google Contacts: OAuth permissions not granted. Please re-authenticate with Contacts permission.',
          type: 'google'
        });
      }
```

- [ ] **Step 3: Verify build**

Run: `cd backend && npx tsc --noEmit 2>&1 | grep "mining.controller"`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/mining.controller.ts
git commit -m "refactor: extract resolveGoogleContactsCredentials helper"
```

---

### Task 2: Extract Error Handler in startMining Catch Block

**Files:**
- Modify: `backend/src/controllers/mining.controller.ts:342-390`

**Analysis:** The catch block has 4 separate if statements checking error text codes, plus a fallback. Extract into a helper that returns the appropriate response.

- [ ] **Step 1: Add helper function**

Add before the `startMining` method:

```typescript
function handleMiningStartError(
  err: unknown,
  sanitizedEmail: string,
  next: NextFunction
) {
  const withMessage = (msg: string) => new Error(msg);

  if (err instanceof Error && 'textCode' in err && err.textCode === 'CANNOT') {
    const conflictRes = { status: 409, body: undefined };
    return conflictRes;
  }

  if (
    err instanceof Error &&
    err.message.includes('Request failed with status code 401')
  ) {
    return {
      status: 401,
      body: 'Failed to start fetching: Invalid credentials 401'
    };
  }

  if (
    err instanceof Error &&
    err.message.includes('Request failed with status code 403')
  ) {
    logger.warn('Google Contacts API returned 403', {
      email: sanitizedEmail
    });
    return {
      status: 403,
      body: {
        error:
          'Google Contacts: Access denied. Please re-authenticate with Contacts permission.',
        type: 'google'
      }
    };
  }

  if (
    err instanceof Error &&
    err.message.includes('Request failed with status code 503')
  ) {
    return {
      status: 503,
      body:
        'Failed to start fetching: Connection not available, please try again later 503'
    };
  }

  const newError = generateErrorObjectFromImapError(err);
  return { status: 500, body: newError.message };
}
```

Wait — looking at the current catch block more carefully, it has a mix of `return res.status(...)` and just `res.status(...).send(...)` without return. The helper approach needs a different pattern. Let me use a simpler approach: extract the error response decision into a pure function that returns `{ status, body, isJson }`, then apply it in the catch.

Actually, let me simplify: define a type for the error response and use a helper that handles sending the response.

- [ ] **Step 2: Add MiningStartErrorResult type and handleMiningError helper**

Add before `resolveGoogleContactsCredentials`:

```typescript
interface MiningStartErrorResult {
  status: number;
  body: unknown;
  shouldLog: boolean;
}
```

And the handler:

```typescript
function classifyMiningError(
  err: unknown,
  sanitizedEmail: string
): MiningStartErrorResult | null {
  if (!(err instanceof Error)) {
    const newError = generateErrorObjectFromImapError(err);
    return { status: 500, body: newError.message, shouldLog: true };
  }

  if ('textCode' in err && err.textCode === 'CANNOT') {
    return null; // conflict — handled as 409
  }

  if (err.message.includes('Request failed with status code 401')) {
    return {
      status: 401,
      body: 'Failed to start fetching: Invalid credentials 401',
      shouldLog: false
    };
  }

  if (err.message.includes('Request failed with status code 403')) {
    logger.warn('Google Contacts API returned 403', {
      email: sanitizedEmail
    });
    return {
      status: 403,
      body: {
        error:
          'Google Contacts: Access denied. Please re-authenticate with Contacts permission.',
        type: 'google'
      },
      shouldLog: false
    };
  }

  if (err.message.includes('Request failed with status code 503')) {
    return {
      status: 503,
      body:
        'Failed to start fetching: Connection not available, please try again later 503',
      shouldLog: false
    };
  }

  const newError = generateErrorObjectFromImapError(err);
  return { status: 500, body: newError.message, shouldLog: true };
}
```

- [ ] **Step 3: Replace the catch block in `startMining`**

Current (lines 342-390):
```typescript
      } catch (err) {
        if (
          err instanceof Error &&
          'textCode' in err &&
          err.textCode === 'CANNOT'
        ) {
          return res.sendStatus(409);
        }

        if (
          err instanceof Error &&
          err.message.includes('Request failed with status code 401')
        ) {
          res
            .status(401)
            .send('Failed to start fetching: Invalid credentials 401');
        }

        if (
          err instanceof Error &&
          err.message.includes('Request failed with status code 403')
        ) {
          logger.warn('Google Contacts API returned 403', {
            userId: user.id,
            email: sanitizedEmail
          });
          return res.status(403).json({
            error:
              'Google Contacts: Access denied. Please re-authenticate with Contacts permission.',
            type: 'google'
          });
        }

        if (
          err instanceof Error &&
          err.message.includes('Request failed with status code 503')
        ) {
          res
            .status(503)
            .send(
              'Failed to start fetching: Connection not available, please try again later 503'
            );
        }

        const newError = generateErrorObjectFromImapError(err);

        res.status(500);
        return next(new Error(newError.message));
      }
```

Replace with:
```typescript
      } catch (err) {
        const errorResult = classifyMiningError(err, sanitizedEmail);

        if (errorResult === null) {
          return res.sendStatus(409);
        }

        if (typeof errorResult.body === 'string') {
          res.status(errorResult.status).send(errorResult.body);
        } else {
          return res.status(errorResult.status).json(errorResult.body);
        }

        if (errorResult.shouldLog) {
          return next(new Error(errorResult.body as string));
        }
      }
```

Wait — this doesn't correctly replicate the original behavior. In the original:
- 401: `res.status(401).send(...)` but NO return (falls through to `res.status(500); return next(...)`)
  Actually wait, looking at the code again:
  ```
  if (err.message.includes('401')) {
    res.status(401).send('Failed to start fetching: Invalid credentials 401');
  }
  ```
  There's no `return` before `res.status(401).send(...)`! This means the 401 handler sends the response but then falls through to `res.status(500); return next(new Error(...))`. This seems like a bug in the original code — the 401 and 503 handlers don't return, unlike the 403 handler which does `return res.status(403).json(...)`.

Let me keep the exact same behavior to avoid introducing bugs. The simplest approach:

```typescript
      } catch (err) {
        const handled = handleMiningError(err, sanitizedEmail, next);
        if (handled) return;
      }
```

And the handler performs the side effects directly. Let me keep it simpler:

- [ ] **Step 4: Simpler approach — extract just the decision logic**

Actually, let me just write a `sendMiningErrorResponse` function:

```typescript
function sendMiningErrorResponse(
  err: unknown,
  res: Response,
  next: NextFunction,
  logger: Logger
): boolean {
  const newError = generateErrorObjectFromImapError(err);
  res.status(500);
  return next(new Error(newError.message));
}
```

No, this is getting complicated. Let me just keep the original behavior but extract it cleanly. The simplest refactor:

```typescript
function isMiningControllerError(err: unknown): { status: number; body: unknown; isJson: boolean } | null {
  if (!(err instanceof Error)) return null;

  if ('textCode' in err && err.textCode === 'CANNOT') {
    return { status: 409, body: undefined, isJson: false };
  }
  if (err.message.includes('Request failed with status code 401')) {
    return { status: 401, body: 'Failed to start fetching: Invalid credentials 401', isJson: false };
  }
  if (err.message.includes('Request failed with status code 403')) {
    return { status: 403, body: { error: 'Google Contacts: Access denied. Please re-authenticate with Contacts permission.', type: 'google' }, isJson: true };
  }
  if (err.message.includes('Request failed with status code 503')) {
    return { status: 503, body: 'Failed to start fetching: Connection not available, please try again later 503', isJson: false };
  }
  return null;
}
```

Then in the catch:
```typescript
const knownError = isMiningControllerError(err);
if (knownError) {
  if (knownError.status === 409) return res.sendStatus(409);
  if (knownError.isJson) return res.status(knownError.status).json(knownError.body);
  res.status(knownError.status).send(knownError.body);
  // fall through to error handler for 401/503
}

const newError = generateErrorObjectFromImapError(err);
res.status(500);
return next(new Error(newError.message));
```

Hmm, but this still doesn't match the original behavior exactly. Let me look more carefully...

The original code:
1. 409: `return res.sendStatus(409)` — returns immediately  
2. 401: `res.status(401).send(...)` — NO RETURN — falls through to line 386-389 (generateErrorObject, res.status(500), return next(...))
3. 403: `return res.status(403).json(...)` — returns immediately
4. 503: `res.status(503).send(...)` — NO RETURN — falls through to line 386-389
5. Then: generateErrorObject, res.status(500), return next(new Error(newError.message))

Wait, but re-reading line 355-358:
```
if (err.message.includes('401')) {
  res.status(401).send('Failed to start fetching: Invalid credentials 401');
}
```

There's no return here. So it sends the 401 response, then falls through to `res.status(500).send(...)` and `return next(...)`. That would send two responses, which would cause an "ERR_HTTP_HEADERS_SENT" error.

Actually, `res.status(401).send(...)` sends the response and the next call to `res.status(500).send(...)` would throw because headers were already sent. This is likely a bug, but it's pre-existing. Let me not change behavior.

Actually, looking at it more carefully with express, `res.send()` is terminal in the sense that it sends the response. After `res.send()`, the function continues but any further attempt to send would error. So the 401 path in the original code does `res.status(401).send(...)` (sends 401), then continues to `res.status(500)` and `return next(...)`. The `next(new Error(...))` would pass an error to the error middleware, which would also try to send a response but headers are already sent, so it would silently fail or log.

This is clearly the original behavior, and I shouldn't try to fix it in this refactor. Let me match it exactly.

Simplest approach: Just extract the Giant If Ladder into a function that returns the error info, and keep the side effects (sending/next) in the catch block.

- [x] **Simpler approach:** just use a single helper function `isMiningControllerError` that returns `{ status, body, isJson } | null`, then use its result in the catch block with minimal duplication.

This is getting too detailed for a plan. Let me write a cleaner, shorter version.

Actually, I think the simplest approach that preserves all behavior is:

```typescript
function isMiningControllerError(err: unknown): { status: number; body: unknown; isJson: boolean } | null {
  if (!(err instanceof Error)) return null;

  if ('textCode' in err && err.textCode === 'CANNOT') {
    return { status: 409, body: undefined, isJson: false };
  }
  if (err.message.includes('Request failed with status code 401')) {
    return { status: 401, body: 'Failed to start fetching: Invalid credentials 401', isJson: false };
  }
  if (err.message.includes('Request failed with status code 403')) {
    return { status: 403, body: { error: 'Google Contacts: Access denied. Please re-authenticate with Contacts permission.', type: 'google' }, isJson: true };
  }
  if (err.message.includes('Request failed with status code 503')) {
    return { status: 503, body: 'Failed to start fetching: Connection not available, please try again later 503', isJson: false };
  }
  return null;
}
```

And the catch becomes:
```typescript
} catch (err) {
  const knownError = isMiningControllerError(err);
  if (knownError) {
    if (knownError.status === 409) {
      return res.sendStatus(409);
    }
    if (knownError.isJson) {
      return res.status(knownError.status).json(knownError.body);
    }
    res.status(knownError.status).send(knownError.body);
  }

  const newError = generateErrorObjectFromImapError(err);
  res.status(500);
  return next(new Error(newError.message));
}
```

This preserves the original behavior exactly:
- 409: returns immediately 
- 401/503: sends response but falls through to error handler (matching original)
- 403: returns immediately with JSON
- Fallback: generates error from IMAP, passes to next

Let me write the clean plan now.
