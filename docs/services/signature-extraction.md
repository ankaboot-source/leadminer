# Signature extraction

Signature extraction reads the block at the bottom of an email and turns it into structured contact fields: name, job title, employer, phone numbers, postal address, and profile URLs. The worker writes those fields onto the person record, and runs both extraction paths from `backend/src/emailSignatureWorker.ts`.

## The two paths

`backend/src/emailSignatureWorker.ts` registers both paths. The regex engine is always present as a fallback. The LLM path is added, as the primary engine, only when `SIGNATURE_OPENROUTER_API_KEY` is set.

| Path                                                                       | What it returns                                                                                                                         | When the code uses it                                                                          |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Regex** (`SignatureRE`, `backend/src/services/signature/regex/index.ts`) | Phone numbers via `libphonenumber-js`, plus LinkedIn and X/Twitter profile URLs. Name, job title, employer, and address stay undefined. | Whenever the LLM path is not configured or has deactivated itself.                             |
| **LLM** (`SignatureLLM`, `backend/src/services/signature/llm/index.ts`)    | Name, job title, employer, postal address, phone numbers, and profile/website URLs, validated against the source text.                  | When `SIGNATURE_OPENROUTER_API_KEY` is set and the engine is active. This is the primary path. |

The LLM path talks to OpenRouter, a commercial hosted service, and uses a fixed list of free-tier models in `backend/src/services/signature/llm/types.ts`. It sends up to three model slugs as a provider-side fallback chain. There is no self-hosted LLM option in this code.

## The cache

`SignatureExtractorCache` wraps the LLM engine (`backend/src/services/signature/llm/signature-extractor-cache.ts`). It hashes the raw signature with SHA-256 and stores the extracted JSON in Redis under `llm-sig:<hash>`. Identical signature blocks therefore do not call the model twice. The TTL is `SIGNATURE_LLM_CACHE_TTL_SECONDS`, defaulting to 86,400 seconds (24 hours). The regex path is not cached because it makes no network call.

## The ZDR flag

`SIGNATURE_LLM_REQUIRE_ZDR` adds `provider: { zdr: true }` to the OpenRouter request, restricting routing to endpoints that do not retain the prompt or completion. Signature blocks contain personal data, but the flag defaults to `false` because ZDR endpoints are slower and less available. The code warns if OpenRouter reports no matching ZDR endpoint, but it does not retry without ZDR and does not deactivate the engine (`backend/src/services/signature/llm/index.ts`). The free models in this build have no ZDR endpoint, so enabling the flag on the free tier means signatures go unextracted rather than being routed to a retaining endpoint.

## Where it runs

The signature worker consumes the signature Redis stream during a mining run; `backend/src/emailSignatureWorker.ts` wires the engines, and `backend/src/workers/email-signature/handler.ts` processes each signature job. A successful extraction updates the person through `upsertContact` and records the raw and extracted values in `private.signatures` (`supabase/migrations/20251107141413_add-signature-table.sql`).

The `Signature` service (`backend/src/services/signature/index.ts`) chooses the first active engine marked as primary, and only falls back to the regex engine when no primary engine is active. It does not retry the regex path just because the LLM returned `null`.

The LLM prompt explicitly rejects device footers, legal disclaimers, quoted replies, newsletter text, and role accounts, and tells the model to return null rather than guess. `cleanOutput` then removes any value that is not literally present in the signature (`backend/src/services/signature/llm/output-checkers.ts`).

A contact is written only when at least one field beyond `email` and `user_id` is present (`extractContact` in `backend/src/workers/email-signature/handler.ts`). An empty extraction therefore leaves the person untouched. The mining status response exposes a `signature` task phase (`backend/src/controllers/mining.controller.ts`), which the UI shows as signature progress.

## Configuration

Relevant keys in `backend/src/config/schema.ts`:

- `SIGNATURE_OPENROUTER_API_KEY` — setting this is what enables the LLM path.
- `SIGNATURE_LLM_CACHE_TTL_SECONDS` — Redis cache TTL, default `86400`.
- `SIGNATURE_LLM_REQUIRE_ZDR` — restrict routing to zero-data-retention endpoints, default `false`.

`SIGNATURE_USE_LLM` is declared in the schema and set in `backend/.env.dev`, but **this build does not read it**; the API key alone decides whether the LLM engine is registered. Likewise, `LLM_ENDPOINT`, `LLM_API_KEY`, and `LLM_PROVIDER` exist in the schema, but `SignatureLLM` hardcodes the OpenRouter URL (`backend/src/services/signature/llm/index.ts:217`) and receives its key through `SIGNATURE_OPENROUTER_API_KEY`. Changing those three keys has no effect here.

Redis is required for the LLM cache. There is no local signature mock; with no API key the worker simply runs the regex path.

## Failure behaviour

Both paths return `null` rather than throwing to the worker:

- The LLM returns `null` on a transport error, an empty or `null` response, malformed JSON, a response string longer than 1,000 characters, or output that does not parse as a `Person` object.
- HTTP 402, 502, or 503 deactivates the LLM engine for the life of the process. Subsequent signatures use the regex fallback. A ZDR routing failure only logs a warning and leaves the engine active.
- The regex engine returns `null` if phone or URL parsing throws.

Because `null` means "no extractable signature", the worker does not write a person update or a `private.signatures` row for that message.

The LLM is throttled to 15 requests/minute while every configured model is a free-tier model, otherwise 1,000 requests/minute (`backend/src/emailSignatureWorker.ts`). OpenRouter applies its own account-wide limits on top; a throttled or rejected request becomes a `null` result.

## Cost or quota

There is no `EMAILS_QUOTA_*` setting for signatures. The regex path is free and local. The LLM path is metered by OpenRouter and rate-limited, which is why the cache and the regex fallback exist.
