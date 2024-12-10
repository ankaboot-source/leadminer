export interface EnrichWebhookResponse {
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
  identifiers?: string[];
  alternateName?: string[];
}

export interface Person {
  url: string;
  email: string;
  name?: string;
  image?: string;
  job_title?: string;
  given_name?: string;
  family_name?: string;
  works_for?: string;
  alternate_name?: string[];
  location?: string[];
  same_as?: string[];
  identifiers: string[];
}

export interface EnricherResponse {
  raw_data: unknown[];
  data: EnricherResult[];
}

export interface EmailEnricher {
  enrichAsync(
    persons: Partial<Person>[],
    webhook: string
  ): Promise<EnrichWebhookResponse>;
  enrichSync(persons: Partial<Person>): Promise<EnricherResponse>;
  enrichmentMapper(data: unknown): EnricherResponse;
}
