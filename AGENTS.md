# AGENTS.md - Leadminer Development Guide

This file provides guidance for AI coding agents working in this repository.

## Project Structure

```
leadminer/
├── backend/           # Node.js/Express API (TypeScript)
├── frontend/          # Nuxt.js Vue frontend (TypeScript)
├── supabase/functions/ # Supabase Edge Functions (Deno/TypeScript)
├── micro-services/
│   └── emails-fetcher/ # Email fetching microservice (TypeScript/Bun)
├── docker-compose*.yml
└── generate_env.sh   # Environment file generator
```

## Build, Lint, and Test Commands

### Root Commands

```bash
npm run install-deps        # Install all dependencies
npm run dev:all           # Start all services
npm run dev:generate-env  # Generate .env files from .env.dev templates
npm run dev:supabase      # Start local Supabase
npm run prettier:fix      # Format all code
```

### Backend (Node.js/Express)

```bash
cd backend

# Development
npm run dev:api           # Start API server
npm run dev:worker        # Start message worker
npm run dev:email-worker  # Start email verification worker
npm run dev:email-signature-worker  # Start signature extraction worker

# Testing
npm run test:unit                    # Run unit tests
npm run test:unit -- --testPathPattern=<file>  # Run single test file
npm run test:unit -- --testNamePattern=<name>  # Run tests matching name
npm run test:integration            # Run integration tests

# Linting & Formatting
npm run lint              # Lint code
npm run lint:fix          # Fix lint issues
npm run prettier:fix      # Format code
npm run build             # Compile TypeScript
```

### Frontend (Nuxt.js)

```bash
cd frontend

npm run dev               # Start dev server
npm run test              # Run Vitest tests
npm run test -- --run     # Run tests once (not watch mode)
npm run test <file>       # Run single test file
npm run lint              # Lint code
npm run lint:fix          # Fix lint issues
npm run prettier:fix      # Format code
npm run build             # Build for production
```

### Emails Fetcher Microservice (Bun)

```bash
cd micro-services/emails-fetcher

bun run dev               # Start dev server
npm run test:unit        # Run unit tests
npm run lint             # Lint code
npm run prettier:fix    # Format code
npm run build            # Compile TypeScript
```

### Supabase Edge Functions (Deno)

```bash
npm run dev:supabase-functions  # Serve functions locally
```

## Code Style Guidelines

### TypeScript Configuration

- **Backend**: Uses `tsconfig.json` with `strict: true`, `noImplicitAny: true`
- **Frontend**: Uses Nuxt's built-in TypeScript
- **Supabase Functions**: Deno with strict mode

### Naming Conventions

- **Files**: kebab-case (e.g., `mining-controller.ts`, `email-campaigns/`)
- **Classes**: PascalCase (e.g., `TasksManager`, `RedisPublisher`)
- **Functions**: camelCase (e.g., `getValidImapLogin`, `extractContacts`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `DEFAULT_SENDER_DAILY_LIMIT`)
- **Interfaces/Types**: PascalCase (e.g., `MiningSource`, `ContactSnapshot`)

### Imports

**Backend/Emails Fetcher (absolute imports via paths):**

```typescript
// Preferred - from package.json "paths" config
import Contacts from "../db/interfaces/Contacts";
import logger from "../utils/logger";
import ENV from "../config";

// External packages
import { NextFunction, Request, Response } from "express";
import { User } from "@supabase/supabase-js";
```

**Frontend:**

```typescript
// Vue/Nuxt patterns
import { useLeadminerStore } from "~/stores/leadminer";
import { useRuntimeConfig } from "#imports";
```

**Supabase Edge Functions:**

```typescript
import { Context, Hono } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
```

### Error Handling

**Backend Express:**

```typescript
// Use custom error classes from utils/errors
import { ImapAuthError, ValidationError } from "../utils/errors";

// Controller pattern
async function controllerMethod(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // ... logic
  } catch (error) {
    next(error); // Pass to error middleware
  }
}
```

**Supabase Edge Functions:**

```typescript
// Return proper HTTP errors
return c.json({ error: "Failed to process campaign" }, 500);

// Use error boundaries in Edge Functions
try {
  // ... logic
} catch (error) {
  console.error("Error processing campaign:", error);
  throw new Error(`Unable to fetch contacts for campaign: ${error.message}`);
}
```

### Validation

- Use **Zod** for runtime validation (backend, emails-fetcher, frontend config)
- Validate env vars at startup using schema.ts
- Use `validateType` helper for runtime type checks

### Database

- **Supabase**: Use admin client (`createSupabaseAdmin`) for privileged operations
- **PostgreSQL**: Use parameterized queries, never string concatenation for SQL
- **Redis**: Use ioredis with connection pooling

### Logging

- Use **winston** logger in backend/microservices
- Include context (user ID, operation) in log messages
- Use appropriate levels: `error`, `warn`, `info`, `debug`

### Testing

- **Jest** for backend and emails-fetcher
- **Vitest** for frontend
- Place tests in `test/unit` or `test/integration` directories
- Match test file name: `controller.ts` → `controller.test.ts`

### Git Conventions

- Branch naming: `feat/`, `fix/`, `docs/` prefixes
- Commit messages: imperative mood, lowercase first letter
- Run `npm run precommit:check` before committing (husky + lint-staged)

### Vue/Frontend Patterns

- Use Composition API with `<script setup>`
- Follow Nuxt 3 conventions (auto-imports in `composables/`, `utils/`)
- Use Pinia for state management
- Use PrimeVue components

### Supabase Edge Functions

- Use Hono framework
- Import shared code from `../_shared/` directory
- Always verify service role key for admin operations
- Handle CORS properly using shared cors headers

## Environment Variables

- All services read from `.env` files
- Use `.env.dev` as template (copied by `npm run dev:generate-env`)
- **Important**: Set `SUPABASE_PROJECT_URL` to your public Supabase URL for self-hosted deployments

## Additional Notes

- Node.js >= 20.0.0 required
- Bun >= 1.1.0 required for emails-fetcher
- Docker and Docker Compose required for local dev
