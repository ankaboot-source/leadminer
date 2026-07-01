/**
 * Enricher orchestrator, ported from
 * `backend/src/services/enrichment/Enricher.ts`.
 *
 * The Enricher coordinates a list of `Engine` instances and exposes
 * three entry points:
 * - `enrichSync`: tries every sync-capable engine in order, returning
 *   the first one that produces data.
 * - `enrichAsync`: tries every async-capable engine in order, returning
 *   the first one that produces a job token.
 * - `enrich`: generator wrapper around `enrichSync` for batch flows.
 * - `parseResult`: dispatches a raw result payload to the matching
 *   engine by name.
 *
 * Edge-specific adaptations:
 * - The winston `Logger` is replaced with the shared edge `createLogger`
 *   from `../_shared/logger.ts`.
 * - `enrichSync`/`enrichAsync` return `EngineResponse | null` (instead
 *   of `EngineResponse | undefined`) to give the calling code a single,
 *   predictable "no result" sentinel.
 */

import type { Logger } from "../../_shared/logger.ts";
import { createLogger } from "../../_shared/logger.ts";
import type { Engine, EngineResponse, Person } from "./engine.ts";
import EnrichLayer from "./enrich-layer.ts";
import Thedig from "./thedig.ts";
import Voilanorbert from "./voilanorbert.ts";

export default class Enricher {
  constructor(
    private readonly engines: Engine[],
    private readonly logger: Logger,
  ) {}

  private logError(context: string, error: unknown): void {
    const message = (error as Error).message || "Unexpected error";
    this.logger.error(`[${context}]: ${message}`, { error: String(error) });
  }

  private async sync(
    engine: Engine,
    contact: Partial<Person>,
  ): Promise<EngineResponse | null> {
    try {
      const result = await engine.enrichSync(contact);
      return result;
    } catch (error) {
      this.logError("EnrichEngine._sync", error);
    }
    return null;
  }

  private async asyncRun(
    engine: Engine,
    contacts: Partial<Person>[],
    webhook: string,
  ): Promise<EngineResponse | null> {
    try {
      const result = await engine.enrichAsync(contacts, webhook);
      return result;
    } catch (error) {
      this.logError("EnrichEngine._async", error);
    }
    return null;
  }

  async enrichSync(contact: Partial<Person>): Promise<EngineResponse | null> {
    const engines = this.engines.filter((enricher): enricher is Engine =>
      Boolean(enricher?.isValid(contact) && enricher.isSync)
    );

    if (!engines.length) throw new Error("No Engines to use.");

    for (const engine of engines) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.sync(engine, contact);
      // Break on successful enrichment with data
      if (result?.data?.length) return result;
    }
    return null;
  }

  async enrichAsync(
    contacts: Partial<Person>[],
    webhook: string,
  ): Promise<EngineResponse | null> {
    const engines = this.engines.filter((enricher): enricher is Engine =>
      Boolean(enricher?.isAsync)
    );

    if (!engines.length) throw new Error("No Engines to use.");

    for (const engine of engines) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.asyncRun(engine, contacts, webhook);
      // Break on successful enrichment with token
      if (result?.token) return result;
    }
    return null;
  }

  async *enrich(contacts: Partial<Person>[]) {
    for (const contact of contacts) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.enrichSync(contact);
      if (result) {
        yield result;
      }
    }
  }

  parseResult(result: unknown[], engineName: string): EngineResponse {
    const engine = this.engines.findLast(({ name }) => name === engineName);
    const parsed = engine?.parseResult(result);
    return {
      engine: engineName,
      data: parsed?.data || [],
      raw_data: parsed?.raw_data || [],
    };
  }
}

/**
 * Build the default `Enricher` singleton used by the edge function.
 *
 * Each engine is only instantiated when its environment variables are
 * present, mirroring the backend's `services/enrichment/index.ts` setup.
 * The `Enricher` itself is created only if at least one engine is
 * available.
 */
export function createDefaultEnricher(): Enricher {
  const logger = createLogger("enrich-engines");

  const engines: Engine[] = [];

  const enrichLayerUrl = Deno.env.get("ENRICHLAYER_URL");
  const enrichLayerKey = Deno.env.get("ENRICHLAYER_API_KEY");
  if (enrichLayerUrl && enrichLayerKey) {
    engines.push(new EnrichLayer());
  }

  const thedigUrl = Deno.env.get("THEDIG_URL");
  const thedigKey = Deno.env.get("THEDIG_API_KEY");
  if (thedigUrl && thedigKey) {
    engines.push(new Thedig());
  }

  const voilanorbertKey = Deno.env.get("VOILANORBERT_API_KEY");
  const voilanorbertUser = Deno.env.get("VOILANORBERT_USERNAME");
  if (voilanorbertKey && voilanorbertUser) {
    engines.push(new Voilanorbert());
  }

  return new Enricher(engines, logger);
}
