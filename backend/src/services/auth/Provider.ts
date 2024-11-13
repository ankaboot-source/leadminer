import IMAPSettingsDetector from '@ankaboot.io/imap-autoconfig';

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
  tls: boolean;
}

const PROVIDER_CONFIG: Record<Provider, ImapConfig> = {
  google: {
    host: 'imap.gmail.com',
    port: 993,
    tls: true
  },
  azure: {
    host: 'outlook.office365.com',
    port: 993,
    tls: true
  }
};

export function getDomainFromEmail(email: string) {
  return email.split('@')[1]?.split('.')[0];
}

export async function getOAuthImapConfigByEmail(email: string) {
  const domain = getDomainFromEmail(email);
  const provider = PROVIDER_BY_DOMAIN.get(domain);
  const imapConfig = provider ? PROVIDER_CONFIG[provider] : null;

  if (imapConfig) {
    return imapConfig;
  }

  const imapAutoConf = await new IMAPSettingsDetector().detect(email, 'test');

  if (imapAutoConf) {
    return {
      host: imapAutoConf.host,
      port: imapAutoConf.port,
      tls: imapAutoConf.secure
    };
  }
  throw new Error(`Could not detect IMAP configuration for email: ${email}`);
}
