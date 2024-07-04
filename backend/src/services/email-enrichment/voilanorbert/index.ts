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

  async enrichWebhook(emails: string[], webhook: string): Promise<any> {
    const response = await this.client.enrich(emails, webhook);
    return response;
  }

  webhookHandler(enrichedData: VoilanorbertWebhookResult): EnricherResult[] {
    this.logger.info(
      `[${this.constructor.name}]-[webhookHandler]: Parsing enrichement results`
    );
    const { results } = enrichedData;
    const enriched = results.map(
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
        email: email ?? '',
        image: '',
        fullName: fullName ?? '',
        organization: organization ?? '',
        role: title ?? '',
        location: location ?? '',
        same_as: [facebook, linkedin, twitter].filter(Boolean)
      })
    );
    return enriched;
  }
}
