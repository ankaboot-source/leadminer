/**
 * Barrel re-export of the enrichment engine stack.
 *
 * This module is a thin facade over the per-engine files
 * (`engine.ts`, `enricher.ts`, `enrich-layer.ts`, `thedig.ts`,
 * `voilanorbert.ts`, `validation.ts`) and the engine singleton.
 *
 * It exists so existing callers (`index.ts`, the planned
 * `enrichments-client.ts` from Review #3, and the test file that
 * inspects the engines module for type exports) keep their existing
 * import paths.
 */

import { createDefaultEnricher, default as Enricher } from "./enricher.ts";
import type { EngineResponse, EngineResult, Person } from "./engine.ts";
import EnrichLayer from "./enrich-layer.ts";
import Thedig from "./thedig.ts";
import Voilanorbert from "./voilanorbert.ts";

// Singleton instance configured from environment variables. Created
// lazily so that tests (or test-time dynamic imports) can override
// `Deno.env` before the engines are constructed.
let _defaultEnricher: Enricher | null = null;

function getDefaultEnricher(): Enricher {
  if (!_defaultEnricher) {
    _defaultEnricher = createDefaultEnricher();
  }
  return _defaultEnricher;
}

/**
 * Try sync enrichment engines in order. Returns the first engine
 * response that contains data, or `null` if every engine failed or
 * none were applicable.
 */
export function enrichSync(
  person: Partial<Person>,
): Promise<EngineResponse | null> {
  return getDefaultEnricher().enrichSync(person);
}

/**
 * Try async enrichment engines in order. Returns the first engine
 * response that yields a job token, or `null`.
 */
export function enrichAsync(
  contacts: Partial<Person>[],
  webhook: string,
): Promise<EngineResponse | null> {
  return getDefaultEnricher().enrichAsync(contacts, webhook);
}

/**
 * Dispatch a raw result payload to the matching engine's `parseResult`.
 */
export function parseResult(
  result: unknown[],
  engineName: string,
): EngineResponse {
  return getDefaultEnricher().parseResult(result, engineName);
}

export { Enricher, EnrichLayer, Thedig, Voilanorbert };
export type { EngineResponse, EngineResult, Person };
