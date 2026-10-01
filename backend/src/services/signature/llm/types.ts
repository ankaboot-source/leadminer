/**
 * LLMModels (Open-source)
 *
 * Every slug here is a `:free` model. Order is the priority order —
 * `SignatureLLM` sends `LLMModelsList.slice(0, 3)` to OpenRouter as its
 * provider-fallback chain, so the first three are the ones that take traffic
 * and are deliberately three different vendors.
 *
 * Selection criteria:
 *   1. accepts `response_format: { type: 'json_schema', strict: true }`
 *   2. returns schema-valid Person JSON within MAX_OUTPUT_TOKENS (1000)
 *   3. sustains the production request rate without 429s
 *   4. highest weighted field accuracy on a 30-case signature benchmark
 *
 * All five are reasoning models, so `SignatureLLM` sends
 * `reasoning: { enabled: false }`. Without it, 500-1100 of the 1000 output
 * tokens are spent thinking and the response comes back empty or truncated,
 * which `extract()` silently discards as a parse failure — indistinguishable
 * from an email that simply has no signature.
 *
 * Order is by sustained reliability rather than raw accuracy, because on the
 * free tier the two disagree. Measured at the production throttle of 15 req/min
 * (16-20 requests per model):
 *
 *   model                            accuracy  usable  p50     errors
 *   nvidia/...-super-120b-a12b:free     72.6%    17/20   790ms   3/20
 *   dots-studio/...-note-preview:free   65.8%    16/20   1360ms  4/20
 *   poolside/laguna-s-2.1:free          60.5%    10/16   1003ms  3/16 + 3x429
 *   nvidia/...-ultra-550b-a55b:free     71.5%     6/16   801ms   1/16
 *   nvidia/...-nano-omni-30b:free       52.6%     7/16   718ms   2/16
 *
 * `nemotron-3-ultra-550b` is second-best on accuracy but returns HTTP 200 with
 * an empty body on a quarter to a third of requests, so it is kept out of the
 * top three despite that. That leaves `laguna-s-2.1` in slot 3 on reliability
 * rather than accuracy, to give the chain a non-NVIDIA vendor.
 *
 * Operational limits:
 *   - OpenRouter allows 20 requests/minute ACCOUNT-WIDE across all `:free`
 *     models (`X-RateLimit-Limit: 20`, error code `free-models-per-min`),
 *     plus 1000/day. `emailSignatureWorker.ts` throttles to 15 req/min while
 *     every configured model is free, which is correctly under 20 — but because
 *     the limit is account-wide, a second worker replica will exceed it.
 *   - Even at that rate, 15-20% of requests fail at the connection level with
 *     no HTTP response (`status: 0, fetch failed`). Reproducible, and not
 *     local. Those become ordinary `null` signatures, which is why the regex
 *     fallback remains required.
 *
 * Do not add a slug that only partially satisfies (1)-(2). The catalog's
 * `supported_parameters` overstates schema support for some models and omits it
 * for others, and a model that returns malformed JSON is worse than a missing
 * one because it produces inconsistent fields instead of a clean "no data"
 * result. Check the slug is live against `GET https://openrouter.ai/api/v1/models`
 * (public, no key required) before adding it.
 */
export enum LLMModels {
  nemotron3Super120b = 'nvidia/nemotron-3-super-120b-a12b:free',
  dots3NotePreview = 'dots-studio/dots-3-note-preview:free',
  lagunaS21 = 'poolside/laguna-s-2.1:free',
  nemotron3Ultra550b = 'nvidia/nemotron-3-ultra-550b-a55b:free',
  nemotron3NanoOmni = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
}

export type LLMModelType = `${LLMModels}`;

export const LLMModelsList = Object.values(LLMModels);
