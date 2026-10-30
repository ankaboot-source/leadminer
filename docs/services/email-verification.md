# Email verification

## What it is

Email verification asks whether an address can actually receive mail before you keep it or contact it. Leadminer labels every checked address `VALID`, `RISKY`, `INVALID`, or `UNKNOWN`, with a JSON `details` object explaining why.

## Why the product needs it

Mined mailboxes contain stale addresses, disposable domains, role accounts such as `support@`, and catch-all domains that accept everything. Sending to those addresses wastes effort and hurts sender reputation. Verification lets the cleaning stage drop or flag contacts that are unlikely to reply.

## Which providers, and how they differ

The factory in `backend/src/services/email-status/EmailStatusVerifierFactory.ts` registers providers in this order: **Reacher**, **MailerCheck**, **ZeroBounce**. Only configured providers are registered.

| Provider        | What it returns                                                                                                           | When the code picks it                                                                                                                                                  | Env keys                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Reacher**     | Reachability plus SMTP and miscellaneous flags: deliverable, catch-all, role account, disposable, disabled, full inbox    | First, for every email except the domains routed to the other two providers. Supports single checks and bulk jobs (`backend/src/services/email-status/reacher/`).       | `REACHER_HOST`, `REACHER_API_KEY` or `REACHER_HEADER_SECRET`, plus the SMTP/proxy/timeout keys in `backend/src/config/schema.ts` |
| **MailerCheck** | Provider classification: valid, catch-all, role, disposable, mailbox full, blocked, mailbox not found, syntax error, typo | Second, and only for Hotmail/Yahoo/Live/Outlook/MSN and the French domains in `MAILERCHECK_ZEROBOUNCE_DOMAIN_REGEX` (`backend/src/utils/constants.ts`).                 | `MAILERCHECK_API_KEY`                                                                                                            |
| **ZeroBounce**  | Status plus sub-status: valid, invalid, unknown, catch-all, spamtrap, abuse, do-not-mail                                  | Third, as the catch-all bucket: it receives every address left after the earlier providers' quota and domain filters (`backend/src/services/email-status/zerobounce/`). | `ZEROBOUNCE_API_KEY`                                                                                                             |

**Reacher is the self-hostable option.** It is open source, and the repository's `README.md:144` describes both a hosted service and a self-hosted setup. `REACHER_HOST` defaults to `https://api.reacher.email`; point it at your own instance to keep verification in-house. MailerCheck and ZeroBounce are commercial hosted services only.

## The result model

The four statuses are defined in `backend/src/services/email-status/EmailStatusVerifier.ts`:

- **VALID** — the provider considers the mailbox deliverable (`isDeliverable`).
- **RISKY** — deliverable but questionable: role account, full inbox, past delivery issues, or a provider "unknown" classification that still warrants caution.
- **INVALID** — disposable, blocked, non-existent, syntax error, spamtrap, abuse, or do-not-mail.
- **UNKNOWN** — catch-all domains, provider uncertainty, or a timeout where the provider could not decide.

Provider payloads are normalised in each provider's `mappers.ts` or `mapper.ts`. The `details` object carries booleans such as `isDisposable`, `isRole`, `isCatchAll`, and `hasTimedOut`, plus `source`. The flags are not identical across providers, so treat `details` as provider-specific context rather than a fixed schema.

A result belongs to an address, not to a contact. If the same email appears on several contacts, the batch is deduplicated and one verification result is stored and reused for all of them.

Results are stored in `private.email_status` (`supabase/migrations/20241205095428_migrate_to_private_schema.sql:108`): one row per email, with `user_id`, `status`, `details` as JSONB, and `verified_on`. Row-level security lets an authenticated user select only their own rows. The worker writes through `PgContacts.upsertEmailStatus` (`backend/src/db/pg/PgContacts.ts`), which also tags role accounts on `private.persons`.

## Where it is used in the product

The worker is `backend/src/emailVerificationWorker.ts`. It consumes the cleaning Redis stream during a mining run. `hasEmailVerificationConfigured` gates whether the clean task is added at all (`backend/src/services/tasks-manager-v2/factories.ts` and `backend/src/controllers/mining.controller.ts`), so with no provider configured the cleaning step is unavailable rather than silently skipped.

`backend/src/workers/email-verification/emailVerificationHandlers.ts` groups a batch by provider, checks the Redis status cache and `private.email_status`, calls the verifier, then persists the result. A batch is deduplicated by email before assignment, so two contacts sharing an address share one verification job. The UI exposes the label as a status column and filter in `frontend/src/components/mining/table/MiningTable.vue`.

A separate manual re-check endpoint (`backend/src/controllers/contacts-verification.controller.ts`) always uses Reacher, regardless of which providers are configured. It writes the result, updates the person's status, and returns the status and details as JSON to the caller.

## Configuration

Provider keys are in `backend/src/config/schema.ts`:

- Reacher: `REACHER_HOST`, `REACHER_API_KEY`, `REACHER_HEADER_SECRET`, `REACHER_SMTP_FROM`, `REACHER_SMTP_HELLO`, proxy keys, `REACHER_REQUEST_TIMEOUT_MS`, `REACHER_SMTP_CONNECTION_TIMEOUT_SECONDS`, `REACHER_SMTP_CONNECTION_RETRIES`, `REACHER_HOTMAIL_USE_HEADLESS`, `REACHER_MICROSOFT365_USE_API`, `REACHER_GMAIL_USE_API`, `REACHER_YAHOO_USE_API`, `REACHER_RATE_LIMITER_REQUESTS`, `REACHER_RATE_LIMITER_INTERVAL`.
- MailerCheck: `MAILERCHECK_API_KEY`.
- ZeroBounce: `ZEROBOUNCE_API_KEY`.
- Quotas: `EMAILS_QUOTA_REACHER`, `EMAILS_QUOTA_MAILERCHECK`, `EMAILS_QUOTA_ZEROBOUNCE`.
- Reacher throughput: `REACHER_RATE_LIMITER_REQUESTS` and `REACHER_RATE_LIMITER_INTERVAL` set the Redis-backed token bucket shared by worker processes.

`.env.dev` uses a public Reacher mock at `https://stoplight.io/mocks/reacher/backend/68673`. There is no in-repo email-verification mock.

## Failure behaviour

Failures are converted into results, not crashes, in most cases:

- Reacher single checks return `UNKNOWN` on timeout or HTTP 422; bulk jobs return `UNKNOWN` with `hasTimedOut: true` after three failed status polls (`backend/src/services/email-status/reacher/index.ts`).
- MailerCheck single checks return a `null` status with `hasTimedOut: true` on error. Bulk verification throws on HTTP 402 or 429, and otherwise returns `UNKNOWN` (`backend/src/services/email-status/mailercheck/index.ts`).
- ZeroBounce single checks return a `null` status on error. Bulk verification throws on 429 or an exhausted provider balance, and otherwise returns `UNKNOWN` (`backend/src/services/email-status/zerobounce/index.ts`).

The worker only persists a result when `result.status` is truthy (`emailVerificationHandlers.ts`), so a `null` status is not written to `private.email_status`. An unconfigured provider is absent from the rotation entirely; there is no placeholder verifier to fall back to.

## Cost or quota considerations

The `EMAILS_QUOTA_*` values cap how many addresses one verifier receives in a batch (`partitionEmailsByQuota` in `EmailStatusVerifierFactory.ts`). They are per-batch limits, not global monthly counters; the last registered verifier receives all remaining addresses even beyond its quota. The comments in `backend/.env.dev:87` describe the defaults as approximate capacity in a ten-minute window. Every check is also a metered call to a third-party service.
