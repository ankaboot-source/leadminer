# Contact enrichment

Enrichment fills in job title, employer, location, photo, and social profiles for a person you already have an email address for. The backend builds one engine per configured provider and runs them from `POST /api/enrich/person` through `backend/src/controllers/enrichment.controller.ts`.

## Providers

`backend/src/services/enrichment/index.ts` registers the engines in this order: TheDig, EnrichLayer, VoilaNorbert.

| Provider         | What it returns                                                                                                     | When the code picks it                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **TheDig**       | Name, given/family name, job title, organisation, photo, location, profile URLs, identifiers                        | First synchronous engine. Only for contacts that have both an email **and** a name (`backend/src/services/enrichment/thedig/index.ts`).         |
| **EnrichLayer**  | Full name, first/last name, occupation, first company in experience history, photo, city/state/country, social URLs | Second synchronous engine. Any contact with an email (`backend/src/services/enrichment/enrich-layer/index.ts`).                                 |
| **VoilaNorbert** | Full name, organisation, job title, location, Facebook/LinkedIn/Twitter URLs                                        | Asynchronous engine, used only after the synchronous pass leaves contacts unenriched (`backend/src/services/enrichment/voilanorbert/index.ts`). |

TheDig is the only provider you can run yourself: it is open source, and `backend/.env.dev:120` points at its upstream repository. EnrichLayer and VoilaNorbert are commercial hosted services with no self-hosted option in this codebase.

Lookup depth differs: EnrichLayer is called with `lookup_depth: 'superficial'` and `enrich_profile: 'enrich'`; TheDig returns schema.org-style person fields for the name and email you already have; VoilaNorbert accepts a batch of addresses and reports back later.

## How a request flows

The **Enrich** action on the mining contact table (`frontend/src/components/mining/enrich/EnrichGdprSidebar.vue`) calls the routes in `backend/src/routes/enrichment.routes.ts`:

- `POST /api/enrich/person`
- `POST /api/enrich/person/bulk`
- `POST /api/enrich/webhook/:id` (called by an asynchronous provider, not the browser)

`backend/src/controllers/enrichment.controller.ts` validates the selection, prepares the contact list, and runs the engines through `backend/src/controllers/enrichment.helpers.ts`. Synchronous results are written immediately. VoilaNorbert returns a token; its webhook parses the payload and writes the result.

Before calling a provider, `enrichFromCache` checks `private.enriched_most_recent`, an RPC defined in `supabase/migrations/20241024202442_enriched_most_recent_function.sql`, and skips contacts with a recent result. New results update `private.persons` through `backend/src/db/supabase/enrichments.ts`.

Enrichment is incremental. The request carries `updateEmptyFieldsOnly`, stored on the task as `p_update_empty_fields_only`; the database procedure keeps existing values and fills only blank fields when that flag is set. "Enrich all contacts" reads every refined person for the user and fetches them in chunks of 150 (`backend/src/controllers/enrichment.helpers.ts`).

Both endpoints return a task object, not the enriched contacts. The frontend tracks that task in `frontend/src/stores/enrichment.ts`; synchronous work may already be complete when the response arrives, while an asynchronous job remains running until its webhook fires.

## Configuration

All provider keys live in `backend/src/config/schema.ts`; an engine is created only when its required keys are present, otherwise it is skipped at startup (`backend/src/services/enrichment/index.ts`). The URL keys are required even for commercial providers, so you can point them at a proxy or a compatible endpoint.

`LOAD_BALANCE_ENRICHERS` is declared in `backend/src/config/schema.ts:104` with a default of `false`, but **this build does not read it**. A grep across `backend/src` finds no consumer, so it does not change engine selection. Leave it unset.

All provider keys are optional in the schema, so a fresh environment starts with zero enrichment engines until you add at least one set. For development, `backend/src/mocks/enrichment/server.ts` runs a local mock on port `8083` for VoilaNorbert and EnrichLayer. Start it from `backend/` with `npm run dev:mock-external-services`. The mock does not implement a TheDig route, even though `backend/.env.dev` points `THEDIG_URL` at the same port.

## Failure behaviour

Provider errors are caught per engine. `Enricher` logs the error and returns `null` for that engine, then tries the next synchronous engine if the earlier one produced no data (`backend/src/services/enrichment/Enricher.ts`). Asynchronous errors are also logged and returned as `null`; the task then ends without enrichment.

If no engine is configured at all, `Enricher` throws `No Engines to use.`, which surfaces as a 500. The controller only maps errors starting with `Enricher not found.` to HTTP 503 (`backend/src/controllers/enrichment.controller.ts`), a message no code in this flow throws, so that 503 branch is not reached.

Each engine has an in-memory token-bucket limiter: 55 requests/minute for TheDig, 295 for EnrichLayer, and 115 for VoilaNorbert (`backend/src/services/enrichment/index.ts`). Because these use `Distribution.Memory`, each backend process gets its own budget rather than sharing one across replicas. When a provider rate-limits or rejects a request, the axios error propagates to the engine, then to `Enricher`, which logs it and moves on.

An unknown webhook task or token returns HTTP 404 (`backend/src/controllers/enrichment.controller.ts`). That route has no auth middleware in `backend/src/routes/enrichment.routes.ts`; it relies on the task id in the URL and the token in the payload matching a stored result.

TheDig also exposes a bulk endpoint, but this build registers it as synchronous only (`isAsync = false` in `backend/src/services/enrichment/thedig/index.ts`).

## Cost or quota

This codebase exposes no `EMAILS_QUOTA_*` setting for enrichment. Each provider lookup is metered by the provider itself, and the cache is the main way the product avoids paying twice for the same email. TheDig is the only path where you can replace a metered lookup with your own infrastructure.

## See also

[email-verification.md](email-verification.md), [signature-extraction.md](signature-extraction.md), [../mining-pipeline.md](../mining-pipeline.md).
