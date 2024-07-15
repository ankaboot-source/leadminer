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
    this.logger.info(
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
          email: email ?? undefined,
          name: fullName ?? undefined,
          address: location ?? undefined,
          organization: organization ?? undefined,
          jobTitle: title ?? undefined,
          sameAs: [facebook, linkedin, twitter].filter(Boolean)
        })
      )
      .filter(({ email }) => email !== 'Email');
    return enriched;
  }
}
