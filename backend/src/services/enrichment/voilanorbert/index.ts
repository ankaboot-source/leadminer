import { Logger } from 'winston';
import { Engine, EngineResponse, Person } from '../Engine';
import VoilanorbertApi, { ResponseWebhook } from './client';
import {
  undefinedIfEmpty,
  undefinedIfFalsy
} from '../../../utils/helpers/validation';

export default class Voilanorbert implements Engine {
  readonly name = 'voilanorbert';

  readonly isSync = false;

  readonly isAsync = true;

  constructor(
    private readonly client: VoilanorbertApi,
    private readonly logger: Logger
  ) {}

  // eslint-disable-next-line class-methods-use-this
  isValid(contact: Partial<Person>) {
    return Boolean(contact.email);
  }

  enrichSync(person: Partial<Person>): Promise<EngineResponse> {
    this.logger.debug(
      `Got ${this.constructor.name}.enrichSync request`,
      person
    );
    throw new Error(
      `[${this.constructor.name}]: method enrichSync not implemented.`
    );
  }

  async enrichAsync(persons: Partial<Person>[], webhook: string) {
    this.logger.debug(
      `Got ${this.constructor.name}.enrichAsync request`,
      persons
    );
    try {
      const response = await this.client.enrich(
        persons.map(({ email }) => email as string),
        webhook
      );

      if (!response.success) {
        throw new Error('Failed to upload emails to enrichment.');
      }

      return {
        engine: this.name,
        token: response.token,
        data: [],
        raw_data: []
      };
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  parseResult(enrichedData: unknown[]) {
    this.logger.debug(
      `[${this.constructor.name}]-[parseResult]: Parsing enrichment results`,
      enrichedData
    );
    const results =
      (enrichedData[0] as ResponseWebhook).results ??
      (enrichedData as ResponseWebhook['results']);
    const enriched = results
      .map((result) => ({
        email: result.email,
        image: undefinedIfFalsy(''),
        name: undefinedIfFalsy(result.fullName),
        organization: undefinedIfFalsy(result.organization),
        jobTitle: undefinedIfFalsy(result.title),
        location: undefinedIfEmpty([result.location]),
        sameAs: undefinedIfEmpty([
          result.facebook,
          result.linkedin,
          result.twitter
        ])
      }))
      .filter(
        ({ email, name, location, organization, jobTitle, sameAs }) =>
          email !== 'Email' &&
          ![name, location, organization, jobTitle, sameAs].every(
            (field) => field === undefined || field.length === 0
          )
      );
    return {
      engine: this.name,
      data: enriched,
      raw_data: results
    };
  }
}
