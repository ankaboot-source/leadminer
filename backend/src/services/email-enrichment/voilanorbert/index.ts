import { Logger } from 'winston';
import { EmailEnricher, EnricherResult, Person } from '../EmailEnricher';
import Voilanorbert, { VoilanorbertWebhookResult } from './client';
import { undefinedIfFalsy, undefinedIfEmpty } from '../utils';

export default class VoilanorbertEmailEnricher implements EmailEnricher {
  constructor(
    private readonly client: Voilanorbert,
    private readonly logger: Logger
  ) {}

  enrichSync(
    person: Partial<Person>
  ): Promise<{ raw_data: unknown[]; data: EnricherResult[] }> {
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

      return response;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  enrichmentMapper(enrichedData: VoilanorbertWebhookResult) {
    this.logger.debug(
      `[${this.constructor.name}]-[enrichmentMapper]: Parsing enrichment results`,
      enrichedData
    );
    const results = enrichedData.results ?? enrichedData;
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
      data: enriched,
      raw_data: results
    };
  }
}
