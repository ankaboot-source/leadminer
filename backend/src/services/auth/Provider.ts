const GOOGLE_DOMAINS = ['gmail', 'googlemail', 'google'];
const AZURE_DOMAINS = [
  'outlook',
  'hotmail',
  'live',
  'windowslive',
  'dbmail',
  'msn'
];

const PROVIDER_BY_DOMAIN = new Map<string, Provider>();

GOOGLE_DOMAINS.forEach((d) => {
  PROVIDER_BY_DOMAIN.set(d, 'google');
});
AZURE_DOMAINS.forEach((d) => {
  PROVIDER_BY_DOMAIN.set(d, 'azure');
});

type Provider = 'google' | 'azure';
interface ImapConfig {
  host: string;
  port: number;
}

const PROVIDER_CONFIG: Record<Provider, ImapConfig> = {
  google: {
    host: 'imap.gmail.com',
    port: 993
  },
  azure: {
    host: 'outlook.office365.com',
    port: 993
  }
};

export function getDomainFromEmail(email: string) {
  return email.split('@')[1]?.split('.')[0];
}

export function getOAuthImapConfigByEmail(email: string) {
  const domain = getDomainFromEmail(email);
  const provider = PROVIDER_BY_DOMAIN.get(domain);
  const imapConfig = provider ? PROVIDER_CONFIG[provider] : null;

  if (imapConfig === null) {
    throw new Error(`Provider not found for ${email}`);
  }

  return imapConfig;
}
