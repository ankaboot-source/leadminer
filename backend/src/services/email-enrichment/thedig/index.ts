import { Logger } from 'winston';
import { EmailEnricher, EnricherResult, Person } from '../EmailEnricher';
import Voilanorbert from './client';

export interface TheDigEnrichmentResult {
  email: string;
  name: string;
  givenName: string;
  familyName: string;
  alternateName: string[];
  image: string;
  jobTitle: string;
  organization: string;
  homeLocation: string[];
  workLocation: string[];
  sameAs: string[];
  identifier: string[];
  description?: string[];
  error_msg?: string;
}

export class TheDigEmailEnricher implements EmailEnricher {
  constructor(
    private readonly client: Voilanorbert,
    private readonly logger: Logger
  ) {}

  async enrichWebhook(persons: Person[], webhook: string) {
    try {
      const response = await this.client.enrich(persons, webhook);

      if (!response.success) {
        throw new Error('Failed to upload emails to enrichment.');
      }

      return response;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  enrichmentMapper(enrichedData: TheDigEnrichmentResult[]): EnricherResult[] {
    this.logger.debug(
      `[${this.constructor.name}]-[enrichmentMapper]: Parsing enrichment results`,
      enrichedData
    );
    const results = enrichedData;
    const enriched = results
      .map(
        ({
          email,
          name,
          organization,
          jobTitle,
          homeLocation,
          workLocation,
          givenName,
          familyName,
          alternateName,
          sameAs,
          image
        }) => ({
          email,
          name: name || undefined,
          givenName: givenName || undefined,
          familyName: familyName || undefined,
          alternateName: alternateName || undefined,
          image: image || undefined,
          location:
            [...homeLocation, ...workLocation].filter(Boolean) || undefined,
          organization: organization || undefined,
          jobTitle: jobTitle || undefined,
          sameAs: sameAs.length ? sameAs : undefined
        })
      )
      .filter(
        ({
          organization,
          jobTitle,
          location,
          givenName,
          familyName,
          alternateName,
          image
        }) =>
          ![
            organization,
            jobTitle,
            location,
            givenName,
            familyName,
            alternateName,
            image
          ].every((field) => field === undefined || field.length === 0)
      );
    return enriched;
  }
}
