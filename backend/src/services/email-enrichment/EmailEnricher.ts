export type EnricherType = 'voilanorbert';
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

export interface EmailEnricher {
  enrichWebhook(
    emails: string[],
    webhook: string
  ): Promise<EnrichWebhookResopnse>;
  enrichementMapper(data: unknown): EnricherResult[];
}
