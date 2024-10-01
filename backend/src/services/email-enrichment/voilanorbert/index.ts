import { Logger } from 'winston';
import { EmailEnricher, EnricherResult, Person } from '../EmailEnricher';
import Voilanorbert, { VoilanorbertWebhookResult } from './client';

export default class VoilanorbertEmailEnricher implements EmailEnricher {
  constructor(
    private readonly client: Voilanorbert,
    private readonly logger: Logger
  ) {}

  enrichSync(
    person: Partial<Person>
  ): Promise<{ raw_data: unknown; data: EnricherResult[] }> {
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
    const { results } = enrichedData;
    const enriched = results
      .map(
        ({
          email,
          fullName,
          organization,
          title,
          facebook,
          linkedin,
          twitter,
          location
        }) => ({
          image: undefined,
          email,
          name: fullName || undefined,
          location: [location].filter(Boolean) || undefined,
          organization: organization || undefined,
          jobTitle: title || undefined,
          sameAs: [facebook, linkedin, twitter].filter(Boolean)
        })
      )
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
