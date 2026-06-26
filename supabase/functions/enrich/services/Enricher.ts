// Ported from backend/src/services/enrichment/Enricher.ts (Deno-compatible)

import { Engine, EngineResponse, Person } from "../types.ts";

export default class Enricher {
  constructor(private readonly engines: Engine[]) {}

  private logError(context: string, engineName: string, error: unknown): void {
    const message = (error as Error).message || "Unexpected error";
    console.error(`[${context}] ${engineName}: ${message}`);
  }

  private async sync(engine: Engine, contact: Partial<Person>) {
    try {
      const result = await engine.enrichSync(contact);
      return result;
    } catch (error) {
      this.logError("EnrichEngine._sync", engine.name, error);
    }
    return null;
  }

  private async asyncRun(
    engine: Engine,
    contacts: Partial<Person>[],
    webhook: string
  ) {
    try {
      const result = await engine.enrichAsync(contacts, webhook);
      return result;
    } catch (error) {
      this.logError("EnrichEngine._async", engine.name, error);
    }
    return null;
  }

  async enrichSync(contact: Partial<Person>): Promise<EngineResponse | null> {
    const engines = this.engines.filter((enricher): enricher is Engine =>
      Boolean(enricher?.isValid(contact) && enricher.isSync)
    );

    if (!engines.length) throw new Error("No Engines to use.");

    for (const engine of engines) {
      const result = await this.sync(engine, contact);
      // Break on successful enrichment with data
      if (result?.data?.length) return result;
    }
    return null;
  }

  async enrichAsync(
    contacts: Partial<Person>[],
    webhook: string
  ): Promise<EngineResponse | null> {
    const engines = this.engines.filter((enricher): enricher is Engine =>
      Boolean(enricher?.isAsync)
    );

    if (!engines.length) throw new Error("No Engines to use.");

    for (const engine of engines) {
      const result = await this.asyncRun(engine, contacts, webhook);
      // Break on successful enrichment with token
      if (result?.token) return result;
    }
    return null;
  }

  async *enrich(contacts: Partial<Person>[]) {
    for (const contact of contacts) {
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
