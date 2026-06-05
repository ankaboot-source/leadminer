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
npx supabase functions new <function-name>  # Create new function (auto-generates structure)
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
- **SECURITY DEFINER functions**: Always set `SET search_path = ''` to prevent search_path manipulation attacks (Supabase linter rule `function_search_path_mutable`)
- **SECURITY DEFINER functions**: Always set `SET search_path = ''` to prevent search_path manipulation attacks (Supabase linter rule `function_search_path_mutable`)

### Logging

- Use **winston** logger in backend/microservices
- Include context (user ID, operation) in log messages
- Use appropriate levels: `error`, `warn`, `info`, `debug`

### Edge Function Logging (Deno)

**Use the shared structured logger instead of raw console.log:**

```typescript
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("service-name");

// Structured JSON logging with context
logger.debug("Debug information", { userId: "123" });
logger.info("Operation completed", { userId: "123", duration: 150 });
logger.warn("Unexpected state", { details: context });
logger.error("Operation failed", { error: error.message });
```

**Best Practices:**

- Output structured JSON for log aggregators (CloudWatch, Datadog)
- Control verbosity with `LOG_LEVEL` environment variable
- Use English only for developer/operator logs (not user-facing)
- Always include relevant context (user ID, operation, IDs)
- Never log sensitive data (passwords, tokens, PII)
- Use appropriate levels:
  - `debug`: Development-only, detailed troubleshooting
  - `info`: Operational events (token refresh, email sent)
  - `warn`: Recoverable issues, unexpected states
  - `error`: Failures requiring attention

**Example Output:**

```json
{
  "timestamp": "2026-03-02T14:30:00.000Z",
  "service": "email-campaigns",
  "level": "info",
  "message": "OAuth token refreshed",
  "email": "user@example.com"
}
```

### Testing

- **Jest** for backend and emails-fetcher
- **Vitest** for frontend
- Place tests in `test/unit` or `test/integration` directories
- Match test file name: `controller.ts` → `controller.test.ts`

### Git Conventions

- Branch naming: `feat/`, `fix/`, `docs/` prefixes
- Commit messages: imperative mood, lowercase first letter
- Run `npm run precommit:check` before committing (husky + lint-staged)
- PR descriptions: keep them clear and short. Lead with one-line summary, list key changes as bullets, mention how it was tested. Skip verbose background sections unless the context is non-obvious.
- **IMPORTANT - Ask User Before Git Operations:**
  - Ask before creating worktrees (using-git-worktrees skill)
  - Ask before committing changes
  - Ask before pushing to remote
  - Ask before creating pull requests
  - Never automatically commit or push without user approval

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

## CI/CD Deployment Architecture

Leadminer uses a **multi-repo deployment model** with `leadminer` (source code) and `leadminer.io` (ops/infrastructure).

### Repositories

| Repo                                   | Purpose                                                           | Deploy Target     |
| -------------------------------------- | ----------------------------------------------------------------- | ----------------- |
| `ankaboot-source/leadminer`            | Source code (backend, frontend, micro-services)                   | QA & Prod servers |
| `ankaboot-source/leadminer.io`         | Infrastructure (Docker Compose, Ansible, Terraform, CI workflows) | QA & Prod servers |
| `ankaboot-source/leadminer-commercial` | Commercial/billing features (merged via integration script)       | QA & Prod servers |

### Trigger Mechanism (Repository Dispatch)

Pushing to `leadminer/main` does **NOT** deploy directly. Instead, workflows in `leadminer` send `repository_dispatch` events to `leadminer.io`, which then runs the actual deployment workflows.

**Why?** The deployment workflows need access to secrets, server IPs, and infrastructure configs that live in `leadminer.io`.

### Deployment Flow

```
Push to leadminer/main
    │
    ├── backend/** or micro-services/** changed
    │   └── triggers: qa-trigger-backend-build.yml
    │       └── sends: repository_dispatch(type=trigger-qa-backend-build)
    │           └── leadminer.io: qa-backend-build-deploy.yml
    │               ├── builds Docker images (backend + workers)
    │               └── SSH deploys to QA server
    │
    ├── frontend/** changed
    │   └── triggers: qa-trigger-frontend-build.yml
    │       └── sends: repository_dispatch(type=trigger-qa-frontend-build)
    │           └── leadminer.io: qa-frontend-build-deploy.yml
    │               ├── builds frontend Docker image (pushed to Docker Hub)
    │               └── SSH deploys to QA server
    │
    ├── supabase/functions/** changed
    │   └── triggers: push-supabase-functions.yml
    │       └── deploys Edge Functions directly to Supabase project
    │
    └── other changes (docs, tests, etc.)
        └── triggers: qa-trigger-no-build.yml
            └── sends: repository_dispatch(type=trigger-qa-no-build)
                └── leadminer.io: qa-no-build-deploy.yml
                    └── SSH deploys without building (pulls latest images)
```

### QA Deployment Details

**Server**: DigitalOcean droplet (`LEADMINER_QA_IP`)
**Path**: `/home/leadminer-qa/`
**Docker Compose**: Lives in `leadminer.io/docker-compose.yml` (templated via `envsubst`)

Deployment steps (both frontend and backend workflows):

1. Clone/pull `leadminer.io` (config repo) to `~/leadminer.io`
2. Clone/pull `leadminer` (app repo) to `~/leadminer_qa`
3. Run `leadminer-integration.sh` to merge `leadminer-commercial` billing code
4. Template `.env` and `docker-compose.yml` from `leadminer.io` configs
5. **Backend deploy**: `docker compose build --no-cache` for all services, then `up -d`
6. **Frontend deploy**: Pull `ankabootorg/leadminer-frontend:latest` from Docker Hub, then `up -d`
7. Prune unused Docker images

**Important**: The backend builds from source (`docker compose build`) while the frontend pulls a pre-built image from Docker Hub. This means:

- Backend changes are built directly on the QA server
- Frontend changes must go through the build-and-push workflow first

### Supabase Deployment

Supabase (self-hosted) has its own deployment pipeline:

- **QA**: `supabase-deploy-qa.yml` — deploys to QA Supabase server via SSH + Ansible
- **Prod**: `supabase-deploy-prod.yml` — deploys to Prod Supabase server
- **Migrations**: `supabase-migrations-qa.yml` / `supabase-migrations-prod.yml`

Supabase deployments are triggered by:

- Push to `main` with changes in `supabase/functions/**` or `ansible/supabase-deployment/**`
- Manual `workflow_dispatch`

### Production Deployment

**Trigger**: `repository_dispatch(type=trigger-prod)` or `workflow_dispatch`
**Approval**: Requires manual approval via GitHub issue (approvers: baderdean, zieddhf)
**Server**: DigitalOcean droplet (`LEADMINER_PROD_IP`)
**Path**: `/home/leadminer/leadminer_prod`

Prod workflow (`deploy-prod.yml`):

1. Manual approval step
2. Build frontend image (pushes to Docker Hub)
3. SSH deploy to prod server (builds backend from source + pulls frontend image)

### Why a 404 on QA?

If you see a 404 for a newly added API endpoint (e.g., `/api/smtp-senders/regenerate-from-sources`):

1. **Check if the backend was rebuilt** — The QA backend deploy (`qa-backend-build-deploy.yml`) must have run AND succeeded after the merge. If only the frontend was deployed, the backend still runs the old code.
2. **Check workflow status** — Go to `leadminer.io` repo → Actions → check if `qa-backend-build-deploy` is green.
3. **Check build output** — The workflow does `docker compose build --no-cache` which should pick up the latest `main` code. If the clone failed or cached an old commit, the new endpoints won't exist.
4. **Force a re-deploy** — If the workflow failed or was skipped, trigger it manually via `workflow_dispatch` on `qa-backend-build-deploy.yml`.

### Key Gotchas

- **leadminer.io does NOT auto-deploy on leadminer/main push** — It waits for the `repository_dispatch` event.
- **Frontend and backend deploys are separate workflows** — A frontend-only change won't rebuild the backend, and vice versa.
- **The frontend image is shared between QA and Prod** — Both pull `ankabootorg/leadminer-frontend:latest`. This means a prod deploy could accidentally get a QA-tested frontend if the image was overwritten.
- **leadminer-commercial is merged at deploy time** — The integration script copies billing code into the repo before building. If commercial has breaking changes, the build will fail.

## Planning Documents

### docs/plans Directory

Local planning documents for development reference. **Do NOT commit or push to remote.**

When creating: `docs/plans/YYYY-MM-DD-<feature-name>.md`. Delete when feature is complete.

## Quality Assurance

### DeepSource Code Quality Checks

After committing and pushing changes, you may optionally run DeepSource to check for code quality issues.

**Ask the user first:** "Would you like me to run a DeepSource check on your changes?"

If the user agrees, use the deepsource-check skill to scan and fix issues.

#### Quick Reference Commands

```bash
# Check installation
which deepsource

# Check authentication
deepsource auth status

# Scan issues (after pushing)
deepsource issues --output json

# Scan specific PR
deepsource issues --pr <NUMBER> --output json

# Filter by severity
deepsource issues --severity critical --output json
deepsource issues --severity major --output json
```

**Important:** Prefer real code fixes over `skipcq` comments. Type assertions should use `as unknown as Type` instead of `as any`.

### Pre-commit Checks

Before committing, run linting and formatting:

```bash
# Backend/Frontend
npm run lint:fix && npm run prettier:fix

# Or project-specific
cd backend && npm run lint:fix && npm run prettier:fix
cd frontend && npm run lint:fix && npm run prettier:fix
cd micro-services/emails-fetcher && npm run lint && npm run prettier:fix
```

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
