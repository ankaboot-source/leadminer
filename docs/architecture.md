# Architecture

Leadminer mines contacts from email mailboxes. It fetches messages from IMAP or a file, extracts people and organizations, optionally verifies email addresses, and optionally extracts signatures. This page maps the processes, the stores, and the path a mining request takes.

## Repository layout

| Path                            | What lives there                                                                |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `backend/src`                   | Express API, the three workers, and the mining orchestrator.                    |
| `frontend/src`                  | Nuxt app: pages, Pinia stores, components, and the SSE client.                  |
| `micro-services/emails-fetcher` | Bun/Express service that owns IMAP and PST fetching.                            |
| `supabase/functions`            | Deno edge functions for source config, completion, campaigns, and related jobs. |
| `supabase/migrations`           | Timestamped SQL migrations for the `private` schema.                            |

## Process map

| Process                   | Port                          | What it does                                                                                                          | Started by                                                                                                 |
| ------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Backend API               | `8081`                        | Express API. Authenticates users, creates pipelines, serves SSE progress, and proxies source config.                  | `run.sh` (`dev:backend-api`) or `docker-compose.yml` (`leadminer-api`)                                     |
| Contact-extraction worker | —                             | Consumes `messages_stream-<miningId>`, extracts contacts, writes Postgres, and publishes work to the cleaning stream. | `run.sh` (`dev:backend-worker`) or `docker-compose.yml` (`leadminer-contact-extraction-worker`)            |
| Email-verification worker | —                             | Consumes `emails_stream-<miningId>`, verifies deliverability, and updates contact status.                             | `run.sh` (`dev:backend-email-worker`) or `docker-compose.yml` (`leadminer-email-verification-worker`)      |
| Signature worker          | —                             | Consumes the signature stream, extracts signatures, and writes `private.signatures`.                                  | `run.sh` (`dev:backend-email-signature-worker`) or `docker-compose.yml` (`leadminer-signature-worker`)     |
| Emails fetcher            | `8084`                        | Standalone micro-service. Owns IMAP connections and streams fetched messages into Redis.                              | `run.sh` (`dev:micro-services-emails-fetcher`) or `docker-compose.yml` (`leadminer-email-fetcher-service`) |
| Frontend                  | `8082` (dev and compose)      | Nuxt app. Starts mining, opens the progress SSE stream, and renders contacts.                                         | `run.sh` (`dev:frontend`) or `docker-compose.yml` (`leadminer-frontend`)                                   |
| Redis                     | `6379`                        | Streams for work; pub/sub for progress and task commands.                                                             | `docker-compose.dev.yml` or `docker-compose.yml` (`redis`)                                                 |
| Postgres / Supabase       | `54322` local DB, `54321` API | Stores users, sources, messages, contacts, task rows, and signatures.                                                 | `npm run dev:supabase` or your self-hosted Supabase stack                                                  |

Port defaults come from `.env.docker` and the compose files; the local Supabase ports come from `supabase/config.toml`.

## How the pieces talk

### System context

```mermaid
flowchart LR
  B[Browser] --> F[Frontend<br/>Nuxt + SSE client]
  F --> A["Backend API<br/>Express — MiningEngine + Pipeline"]
  A --> R[(Redis<br/>streams + pub/sub)]
  A --> P[(Postgres / Supabase)]
  A --> X["emails-fetcher<br/>Bun + IMAP"]
  X --> R
  A --> E[Supabase edge functions]
  W["Worker processes<br/>Messages / Verification / Signature"] <--> R
  W --> P
```

The API process owns the orchestrator; the three workers are separate processes that only reach it through Redis. The rest of this section is the protocol between them.

### How a mining run is coordinated

```mermaid
sequenceDiagram
  participant Br as browser
  participant API as API
  participant ME as MiningEngine
  participant P as Pipeline
  participant T as Task
  participant R as Redis
  participant MC as MessagesConsumer
  participant SSE as RealtimeSSE

  Note over P,R: 1. Register — control plane
  API->>ME: submit(pipeline)
  ME->>R: SUBSCRIBE miningId
  ME->>P: start()
  P->>P: createConsumerGroups()<br/>xgroup CREATE ... $
  P->>T: start(tasksResolver, redisPublisher)<br/>for each task
  T->>R: PUBLISH stream-management<br/>REGISTER {role, streams}
  R-->>MC: message on stream-management
  MC->>MC: role !== "extract" ? return
  MC->>MC: activeStreams.set(input)<br/>new RedisStreamProducer(output)

  Note over MC,R: 2. Consume and report — data + progress planes
  MC->>R: XREADGROUP GROUP ... NOACK<br/>STREAMS messages_stream-&#60;miningId&#62; &#62;
  R-->>MC: batch of stream entries
  MC->>R: PUBLISH miningId<br/>ProgressMessage {progressType, count}
  R-->>ME: message on miningId
  ME->>P: onMessage(json)
  P->>T: onMessage(msg) on every task
  P->>P: propagateProgress()<br/>checkCompletion()
  P->>SSE: sendSSE(value, "&#60;progressType&#62;-&#60;miningId&#62;")
  SSE-->>Br: SSE event

  Note over Br,MC: 3. Cancel
  Br->>API: POST /api/imap/mine/:type/:userId/:id
  API->>ME: terminate(miningId, processIds)
  ME->>P: cancel(processIds)
  P->>T: stop(true, ...)
  T->>R: PUBLISH stream-management<br/>DELETE {role, streams}
  R-->>MC: message on stream-management
  MC->>MC: activeStreams.delete(input)
```

A run uses three planes, all on the same Redis:

- **Control plane.** `Task.start()` publishes a `StreamCommand` on `REDIS_PUBSUB_COMMUNICATION_CHANNEL` (`stream-management` by default) and `Task.stop()` publishes its `DELETE` form (`backend/src/services/tasks-manager-v2/tasks/Task.ts:106`, `backend/src/services/tasks-manager-v2/tasks/Task.ts:140`). The payload is `{ miningId, role, command, streams: { input, output } }` (`backend/src/services/tasks-manager-v2/types.ts:47`). `StreamRole` is only `extract | clean | signature`: `fetch` and `google-contacts-fetch` are producers, not stream consumers, so they never register (`backend/src/services/tasks-manager-v2/types.ts:13`). Each worker subscribes to that one channel and filters on `role` — `MessagesConsumer` returns unless the role is `extract` (`backend/src/workers/email-message/MessagesConsumer.ts:41`), the verification consumer unless `clean` (`backend/src/workers/email-verification/EmailsVerificationConsumer.ts:30`), the signature consumer unless `signature` (`backend/src/workers/email-signature/consumer.ts:30`). On `REGISTER`, `MessagesConsumer` and `EmailsVerificationConsumer` add the input stream to an active set; `MessagesConsumer` also creates a `RedisStreamProducer` for the declared output stream (`backend/src/workers/email-message/MessagesConsumer.ts:47`, `backend/src/workers/email-verification/EmailsVerificationConsumer.ts:37`). The signature worker consumes its shared stream continuously and only logs the command (`backend/src/workers/email-signature/consumer.ts:34`). On `DELETE` the extract and clean workers drop the stream.
- **Data plane.** `Pipeline.createConsumerGroups()` creates the extraction and cleaning consumer groups at `$` before any task starts (`backend/src/services/tasks-manager-v2/Pipeline.ts:116`); the signature worker creates its own group at boot (`backend/src/emailSignatureWorker.ts:99`). Consumers read with `xreadgroup ... NOACK` and trim what they consumed with `xtrim MINID`, so a stream is a work queue rather than a replay log (`backend/src/utils/streams/redis/RedisMultipleStreamsConsumer.ts:24`, `:51`). `Fetch` only produces, so it has no consumer group.
- **Progress plane.** A worker publishes a `ProgressMessage` to the run's `miningId` channel (`backend/src/services/tasks-manager-v2/types.ts:34`). `MiningEngine.submit` subscribes to that channel and routes each message to `Pipeline.onMessage` (`backend/src/services/tasks-manager-v2/MiningEngine.ts:47`), which calls `task.onMessage(msg)` on every task, then `propagateProgress()` and `checkCompletion()` (`backend/src/services/tasks-manager-v2/Pipeline.ts:145`, `:164`, `:194`). SSE events leave through `RealtimeSSE.sendSSE` to the browser's progress connection (`backend/src/utils/helpers/sseHelpers.ts:39`).

Cancellation walks the same control plane in reverse: `POST /api/imap/mine/:type/:userId/:id` → `MiningEngine.terminate` → `Pipeline.cancel` → `Task.stop()` publishes `DELETE`, and `FetchTask.stop` separately calls the fetcher's `DELETE /api/imap/fetch/stop` (`backend/src/services/tasks-manager-v2/MiningEngine.ts:75`, `backend/src/services/tasks-manager-v2/Pipeline.ts:403`, `backend/src/services/tasks-manager-v2/tasks/FetchTask.ts:92`).

| Redis channel / stream               | Mechanism                     | Who writes                                | Who reads                                   | Payload                                                                                            |
| ------------------------------------ | ----------------------------- | ----------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `REDIS_PUBSUB_COMMUNICATION_CHANNEL` | Pub/sub (`stream-management`) | `Task.start` / `Task.stop`                | Every worker subscriber, filtered by `role` | `StreamCommand`: `{ miningId, role, command: "REGISTER" \| "DELETE", streams: { input, output } }` |
| `messages_stream-<miningId>`         | Stream + consumer group       | `emails-fetcher` (started by `FetchTask`) | `MessagesConsumer` (`ExtractTask`)          | `EmailMessageData`                                                                                 |
| `emails_stream-<miningId>`           | Stream + consumer group       | `MessagesConsumer` output producer        | `EmailsVerificationConsumer` (`CleanTask`)  | `EmailVerificationData`                                                                            |
| `REDIS_SIGNATURE_STREAM_NAME`        | Stream + consumer group       | `emails-fetcher` when body fetch is on    | `EmailSignatureConsumer` (`SignatureTask`)  | `EmailData`                                                                                        |
| `miningId`                           | Pub/sub (one channel per run) | Workers and the fetcher                   | `MiningEngine`                              | `ProgressMessage`: `{ miningId, progressType, count, isCompleted?, isCanceled? }`                  |

Two HTTP hops matter. The API calls the fetcher (`backend/src/services/email-fetching/index.ts` → `POST /api/imap/fetch/start`), and the API calls edge functions through `supabaseClient.functions.invoke` (`backend/src/db/completion.ts`, `backend/src/controllers/mining.controller.ts`).

## Authentication at a glance

The frontend signs in with Supabase Auth and attaches the session token to API calls as the `x-sb-jwt` header (`frontend/src/plugins/api.ts`). The backend reads that header through `SupabaseAuthResolver` and resolves the user with Supabase (`backend/src/services/auth/SupabaseAuthResolver.ts`). Workers trust the `userId` carried in the stream payload; they do not re-authenticate each message.

## The three stores

### Postgres

All durable product data lives in the `private` schema. Grouped by purpose:

| Group                       | Tables                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------- |
| Identity and sources        | `profiles`, `mining_sources`                                                        |
| Mining bookkeeping          | `tasks`, `notifications`                                                            |
| Extracted data              | `messages`, `persons`, `pointsofcontact`, `organizations`, `refinedpersons`, `tags` |
| Verification and enrichment | `email_status`, `signatures`, `engagement`                                          |

See `supabase/migrations/20241205095428_migrate_to_private_schema.sql` for the core schema and `supabase/migrations/20251107141413_add-signature-table.sql` for signatures. The backend reaches Postgres two ways: a `pg` pool for contacts and sources (`backend/src/db/pg/index.ts`), and the Supabase client for tasks and edge functions (`backend/src/db/supabase/tasks.ts`).

### Redis

Redis carries two different kinds of traffic:

| Traffic                    | Mechanism                        | Why                                                                       |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------- |
| Work items                 | Streams (`xadd`, `xreadgroup`)   | Durable, batched, and shared by worker replicas through consumer groups.  |
| Progress and task commands | Pub/sub (`publish`, `subscribe`) | Fire-and-forget signals. Losing one only costs a progress tick, not data. |

The pub/sub control channel is `REDIS_PUBSUB_COMMUNICATION_CHANNEL` (`stream-management` by default). Each mining run also gets its own progress channel named after its `miningId`. See `backend/src/config/schema.ts` lines 25–40.

| Key                           | Shape           | Lifetime                                                    |
| ----------------------------- | --------------- | ----------------------------------------------------------- |
| `messages_stream-<miningId>`  | Stream          | Created per run; deleted in `Pipeline.cleanupStreams`.      |
| `emails_stream-<miningId>`    | Stream          | Created when Clean is enabled; deleted with the run.        |
| `REDIS_SIGNATURE_STREAM_NAME` | Stream          | Shared across runs; group created at worker boot.           |
| `miningId`                    | Pub/sub channel | Subscribed in `MiningEngine.submit`; removed on completion. |
| `stream-management`           | Pub/sub channel | Long-lived; carries `REGISTER` and `DELETE` commands.       |

### File storage

PST imports are uploaded to the Supabase Storage bucket `pst` (`frontend/src/components/mining/stepper-panels/source/ImportPstDialog.vue`) and downloaded by the fetcher before processing (`micro-services/emails-fetcher/src/services/pst/PSTEmailsFetcher.ts`). IMAP messages and parsed contacts do not use object storage.

## The mining request path

1. The browser calls `POST /api/imap/mine/email/:userId` (or `/file`, `/pst`) from the mining screen (`frontend/src/stores/leadminer.ts`).
2. `backend/src/controllers/mining.controller.ts` builds a `Pipeline` with `createImapMining` and passes it to `MiningEngine.submit`.
3. `MiningEngine` subscribes to the run's `miningId` pub/sub channel and calls `pipeline.start`.
4. `Pipeline.start` creates the Redis consumer groups, then starts each task. Each task writes a `private.tasks` row; tasks with streams publish a `REGISTER` command (`backend/src/services/tasks-manager-v2/Pipeline.ts`, `backend/src/services/tasks-manager-v2/tasks/Task.ts`).
5. `FetchTask.start` calls the emails-fetcher over HTTP. The fetcher writes messages into `messages_stream-<miningId>` and progress into the `miningId` channel.
6. `messageWorker` consumes the stream, extracts contacts, and writes them through `PgContacts`.
7. The browser keeps an SSE connection open at `GET /api/imap/mine/:type/:id/progress/`; `Pipeline` forwards progress events to it (`frontend/src/utils/sse.ts`).

## Running it locally

1. `npm run dev:generate-env` copies the `.env.dev` templates. The frontend has only a `.env.example`, so `generate_env.sh` falls back to it.
2. `npm run dev:supabase` starts local Supabase.
3. `docker-compose -f docker-compose.dev.yml up -d` starts Redis and the dev-only mocks.
4. `npm run dev:all` (or `./run.sh`) starts the API, the three workers, the fetcher, and the frontend.

For a containerized self-host, use `docker compose up` with `docker-compose.yml`.

Both the backend and the fetcher validate their environment with Zod at boot (`backend/src/config/schema.ts`, `micro-services/emails-fetcher/src/config/schema.ts`). A missing key stops the process instead of failing later.
