type ReconnectFallbackAction = 'google' | 'azure' | 'imap';

const GOOGLE_DOMAINS = new Set(['gmail.com', 'googlemail.com']);
const AZURE_DOMAINS = new Set([
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
]);

export function resolveReconnectFallbackAction(
  email: string,
): ReconnectFallbackAction {
  const normalizedEmail = email.trim().toLowerCase();
  const atIndex = normalizedEmail.lastIndexOf('@');

  if (atIndex === -1 || atIndex === normalizedEmail.length - 1) {
    return 'imap';
  }

  const domain = normalizedEmail.slice(atIndex + 1);

  if (GOOGLE_DOMAINS.has(domain)) {
    return 'google';
  }

  if (AZURE_DOMAINS.has(domain)) {
    return 'azure';
  }

  return 'imap';
}
