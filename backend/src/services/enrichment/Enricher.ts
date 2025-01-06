import { Logger } from 'winston';
import { Contact } from '../../db/types';
import { Engine } from './Engine';

export default class Enricher {
  constructor(
    private readonly engines: Engine[],
    private readonly logger: Logger
  ) {}

  private logError(context: string, error: unknown): void {
    const message = (error as Error).message || 'Unexpected error';
    this.logger.error(`[${context}]: ${message}`, error);
  }

  private async sync(engine: Engine, contact: Partial<Contact>) {
    try {
      const result = await engine.enrichSync(contact);
      return result;
    } catch (error) {
      this.logError('EnrichEngine._sync', error);
    }
    return null;
  }

  private async async(
    engine: Engine,
    contacts: Partial<Contact>[],
    webhook: string
  ) {
    try {
      const result = await engine.enrichAsync(contacts, webhook);
      return result;
    } catch (error) {
      this.logError('EnrichEngine._async', error);
    }
    return null;
  }

  async enrichSync(contact: Partial<Contact>) {
    const engines = this.engines.filter((enricher): enricher is Engine =>
      Boolean(enricher?.isValid(contact) && enricher.isSync)
    );

    if (!engines.length) throw new Error('No Engines to use.');

    for (const engine of engines) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.sync(engine, contact);
      // Break on successful enrichment with data
      if (result?.data?.length) return result;
    }
    return null;
  }

  async enrichAsync(contacts: Partial<Contact>[], webhook: string) {
    const engines = this.engines.filter((enricher): enricher is Engine =>
      Boolean(enricher?.isAsync)
    );

    if (!engines.length) throw new Error('No Engines to use.');

    for (const engine of engines) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.async(engine, contacts, webhook);
      // Break on successful enrichment with data
      if (result?.token) return result;
    }
    return null;
  }

  async *enrich(contacts: Partial<Contact>[]) {
    for (const contact of contacts) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.enrichSync(contact);
      if (result) {
        yield result;
      }
    }
  }

  parseResult(result: unknown[], engineName: string) {
    const engine = this.engines.findLast(({ name }) => name === engineName);
    const parsed = engine?.parseResult(result);
    return {
      data: parsed?.data || [],
      raw_data: parsed?.raw_data || []
    };
  }
}
