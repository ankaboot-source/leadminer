import ENV from '../config';
import { OAuthMiningSourceProvider } from '../db/interfaces/MiningSources';
import { Contact } from '../db/types';
import azureOAuth2Client from '../services/OAuth2/azure';
import googleOAuth2Client from '../services/OAuth2/google';

const providerScopes = {
  google: {
    scopes: [
      'openid',
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    requiredScopes: [
      'openid',
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ]
  },
  azure: {
    scopes: [
      'https://outlook.office.com/IMAP.AccessAsUser.All',
      'offline_access',
      'email',
      'openid',
      'profile'
    ],
    requiredScopes: ['https://outlook.office.com/IMAP.AccessAsUser.All']
  }
};

type TokenType = {
  refreshToken: string;
  accessToken: string;
  idToken: string;
  expiresAt: number;
};

export function getAuthClient(provider: OAuthMiningSourceProvider) {
  switch (provider) {
    case 'google':
      return googleOAuth2Client;
    case 'azure':
      return azureOAuth2Client;
    default:
      throw new Error('Not a valid OAuth provider');
  }
}

export function getTokenConfig(provider: OAuthMiningSourceProvider) {
  const conf: {
    prompt: string;
    scope: string[];
    redirect_uri: string;
    access_type?: string;
  } = {
    redirect_uri: `${ENV.LEADMINER_API_HOST}/api/imap/mine/sources/${provider}/callback`,
    scope: providerScopes[provider].scopes,
    prompt: 'select_account'
  };

  if (provider === 'google') {
    conf.access_type = 'offline';
  }
  return conf;
}

export async function getTokenWithScopeValidation(
  tokenConfig: {
    code: string;
    scope: string[];
    redirect_uri: string;
    prompt?: string;
    access_type?: string;
  },
  provider: OAuthMiningSourceProvider
) {
  const { token } = await getAuthClient(provider).getToken(tokenConfig);

  const approvedScopes = (token.scope as string).split(' ');

  const hasApprovedAllScopes = providerScopes[provider].requiredScopes.every(
    (scope) => approvedScopes.includes(scope)
  );

  if (!hasApprovedAllScopes) {
    throw new Error(' User has not approved all the required scopes');
  }

  return {
    refreshToken: token.refresh_token,
    accessToken: token.access_token,
    idToken: token.id_token,
    expiresAt: token.expires_at
  } as TokenType;
}

const REGEX_EMAIL = /^\b[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{0,66}\.[A-Z]{2,18}\b$/i;
const isInvalidEmail = (email?: string) =>
  email ? !REGEX_EMAIL.test(email) : false;
function isValidURL(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
/**
 * Starts the mining process.
 * @throws {Error} Throws an error if there is an invalid data.
 */
export function validateFileContactsData(
  contacts: Partial<Contact[]>
): boolean {
  if (!contacts.length) {
    throw new Error('Invalid data');
  }
  contacts.forEach((contact) => {
    if (!contact || isInvalidEmail(contact.email)) {
      throw new Error('Invalid data');
    }

    const URL_OPTIONS = ['image', 'same_as'] as const;
    URL_OPTIONS.forEach((url_option) => {
      const urlValue = contact[url_option];
      if (!urlValue?.length) return;
      if (typeof urlValue === 'string') {
        if (!isValidURL(urlValue)) {
          throw new Error('Invalid data');
        }
      } else if (Array.isArray(urlValue)) {
        if (!urlValue.every((url) => isValidURL(url))) {
          throw new Error('Invalid data');
        }
      }
    });
  });

  return true;
}
