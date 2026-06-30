// Ported from backend/src/services/enrichment/Enricher.ts (Deno-compatible)

import { Engine, EngineClass, EngineResponse, Person } from "../types.ts";

/**
 * Pairs an engine class (used for the stateless `isValid` filter) with
 * an instance (used for stateful `enrichSync`/`enrichAsync`/`parseResult`
 * calls). Storing both lets the Enricher reason about validity via the
 * class without instantiating every engine upfront.
 */
interface EngineRegistration {
  readonly ctor: EngineClass;
  readonly instance: Engine;
}

export default class Enricher {
  constructor(private readonly engines: EngineRegistration[]) {}

  private static logError(context: string, engineName: string, error: unknown): void {
    const message = (error as Error).message || "Unexpected error";
    console.error(`[${context}] ${engineName}: ${message}`);
  }

  private static async sync(registration: EngineRegistration, contact: Partial<Person>) {
    try {
      const result = await registration.instance.enrichSync(contact);
      return result;
    } catch (error) {
      Enricher.logError("EnrichEngine._sync", registration.instance.name, error);
    }
    return null;
  }

  private static async asyncRun(
    registration: EngineRegistration,
    contacts: Partial<Person>[],
    webhook: string
  ) {
    try {
      const result = await registration.instance.enrichAsync(contacts, webhook);
      return result;
    } catch (error) {
      Enricher.logError("EnrichEngine._async", registration.instance.name, error);
    }
    return null;
  }

  async enrichSync(contact: Partial<Person>): Promise<EngineResponse | null> {
    const registrations = this.engines.filter(({ ctor, instance }) =>
      Boolean(ctor.isValid(contact) && instance.isSync)
    );

    if (!registrations.length) throw new Error("No Engines to use.");

    for (const registration of registrations) {
      const result = await Enricher.sync(registration, contact);
      // Break on successful enrichment with data
      if (result?.data?.length) return result;
    }
    return null;
  }

  async enrichAsync(
    contacts: Partial<Person>[],
    webhook: string
  ): Promise<EngineResponse | null> {
    const registrations = this.engines.filter(({ instance }) =>
      Boolean(instance.isAsync)
    );

    if (!registrations.length) throw new Error("No Engines to use.");

    for (const registration of registrations) {
      const result = await Enricher.asyncRun(registration, contacts, webhook);
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
    const registration = this.engines.findLast(({ instance }) =>
      instance.name === engineName
    );
    const parsed = registration?.instance.parseResult(result);
    return {
      engine: engineName,
      data: parsed?.data || [],
      raw_data: parsed?.raw_data || [],
    };
  }
}