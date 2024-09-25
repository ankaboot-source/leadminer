interface EnrichWebhookResopnse {
  status: string;
  success: boolean;
  token: string;
}
export interface EnricherResult {
  email: string;
  name?: string;
  image?: string;
  location?: string[];
  jobTitle?: string;
  organization?: string;
  givenName?: string;
  familyName?: string;
  sameAs?: string[];
}

export interface Person {
  email: string;
  name?: string;
}

export interface EmailEnricher {
  enrichWebhook(
    persons: Partial<Person>[],
    webhook: string
  ): Promise<EnrichWebhookResopnse>;
  enrichmentMapper(data: unknown): EnricherResult[];
}
