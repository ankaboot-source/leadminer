import { Logger } from 'winston';
// import { TaskEnrich } from '../../controllers/enrichment.helpers';
import { Users } from '../../db/interfaces/Users';
import { Contact } from '../../db/types';
import logger from '../../utils/logger';
import {
  EmailEnricher,
  EnricherResponse,
  EnricherResult,
  Person
} from './EmailEnricher';
export type EnricherType = 'voilanorbert' | 'thedig' | 'proxycurl';

export interface Config {
  THEDIG_URL: string;
  THEDIG_API_KEY: string;
  PROXYCURL_URL: string;
  PROXYCURL_API_KEY: string;
  VOILANORBERT_URL: string;
  VOILANORBERT_API_KEY: string;
  VOILANORBERT_USERNAME: string;
}

export interface Engine {
  name: string;
  instance: EmailEnricher;
  isSync: () => boolean;
  isAsync: () => boolean;
  isValid: (contact: Partial<Contact>) => boolean;
}

interface Result {
  token?: string;
  error?: string;
  raw_data: unknown[];
  data: EnricherResult[];
  engine: string;
}

export default class EnrichEngine {
  constructor(
    private readonly engines: Engine[],
    private readonly logger: Logger
  ) {}

  private logError(context: string, error: unknown): void {
    const message = (error as Error).message || 'Unexpected error';
    this.logger.error(`[${context}]: ${message}`, error);
  }

  private async _sync(engine: Engine, contact: Partial<Contact>) {
    const { name, instance } = engine;
    const result: Result = {
      engine: name,
      data: [],
      raw_data: []
    };
    try {
      const { data, raw_data } = await instance.enrichSync(contact);
      result.data.push(...data);
      result.raw_data.push(...raw_data);
    } catch (error) {
      this.logError('EnrichEngine._sync', error);
      result.error = (error as Error).message || 'Unexpected error';
    }
    return result;
  }

  private async _async(engine: Engine, contacts: Partial<Contact>[], webhook: string) {
    const { name, instance } = engine;
    const result: Result = {
      engine: name,
      data: [],
      raw_data: []
    };
    try {
      const { token } = await instance.enrichAsync(contacts, webhook);
      result.token = token;
    } catch (error) {
      this.logError('EnrichEngine._async', error);
      result.error = (error as Error).message || 'Unexpected error';
    }
    return result;
  }

  async enrichSync(contact: Partial<Contact>) {
    const engines = this.engines.filter((enricher): enricher is Engine =>
      Boolean(enricher?.isValid(contact) && enricher.isSync())
    );

    console.log(engines)

    if (!engines.length) throw new Error('No Engines to use.');

    for (const engine of engines) {
      const result = await this._sync(engine, contact);
      console.log(result);
      // Break on successful enrichment with data
      if (result.data?.length > 0) return result;
    }
    return null;
  }

  async enrichAsync(contacts: Partial<Contact>[], webhook: string) {
    const engines = this.engines.filter((enricher): enricher is Engine =>
      Boolean(enricher?.isAsync())
    );

    if (!engines.length) throw new Error('No Engines to use.');

    for (const engine of engines) {
      const result = await this._async(engine, contacts, webhook);
      if (result.token) {
        return result;
      }
    }
    return null;
  }

  async *enrich(contacts: Partial<Contact>[]) {
    for (const contact of contacts) {
      const result = await this.enrichSync(contact);
      if (result) {
        yield result;
      }
    }
  }

  parseResult(result: unknown, engineName: string) {
    const engine = this.engines.findLast(({ name }) => name === engineName);
    const parsed = engine?.instance.enrichmentMapper(result);
    return {
      data: parsed?.data || [],
      raw_data: parsed?.raw_data || []
    };
  }
}
