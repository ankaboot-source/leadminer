export type EnricherType = 'voilanorbert';

export type SocialMediaTypes = 'facebook' | 'twitter' | 'linkedin';

export interface EnricherResult {
  email: string;
  fullName: string;
  image: string;
  role: string;
  organization: string;
  location: string;
  same_as: string[];
}

export interface EmailEnricher {
  enrichWebhook(emails: string[], webhook: string): Promise<any>;
  webhookHandler(data: Record<string, any>): EnricherResult[];
}
