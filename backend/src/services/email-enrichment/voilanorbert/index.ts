import { Logger } from 'winston';
import Voilanorbert from './client';
import { EmailEnricher, EnricherResult } from '../EmailEnricher';

export interface VoilanorbertEnrichmentResult {
  email: string;
  fullName: string;
  title: string;
  organization: string;
  location: string;
  twitter: string;
  linkedin: string;
  facebook: string;
  error_msg?: string;
}

export interface VoilanorbertWebhookResult {
  id: string;
  token: string;
  results: VoilanorbertEnrichmentResult[];
}

export class VoilanorbertEmailEnricher implements EmailEnricher {
  constructor(
    private readonly client: Voilanorbert,
    private readonly logger: Logger
  ) {}

  async enrichWebhook(emails: string[], webhook: string) {
    try {
      const response = await this.client.enrich(emails, webhook);

      if (!response.success) {
        throw new Error('Failed to upload emails to enrichement.');
      }

      return response;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  enrichementMapper(enrichedData: VoilanorbertWebhookResult): EnricherResult[] {
    this.logger.debug(
      `[${this.constructor.name}]-[enrichementMapper]: Parsing enrichement results`,
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
          name: fullName.length ? fullName : undefined,
          address: location.length ? location : undefined,
          organization: organization.length ? organization : undefined,
          jobTitle: title.length ? title : undefined,
          sameAs: [facebook, linkedin, twitter].filter(Boolean)
        })
      )
      .filter(
        ({ email, name, address, organization, jobTitle, sameAs }) =>
          email !== 'Email' &&
          ![name, address, organization, jobTitle, sameAs].every(
            (field) => field === undefined || field.length === 0
          )
      );
    return enriched;
  }
}
