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
  enrichAsync(
    persons: Partial<Person>[],
    webhook: string
  ): Promise<EnrichWebhookResopnse>;
  enrichSync(persons: Partial<Person>): Promise<EnricherResult>;
  enrichmentMapper(data: unknown): {
    raw_data: unknown[];
    data: EnricherResult[];
  };
}
