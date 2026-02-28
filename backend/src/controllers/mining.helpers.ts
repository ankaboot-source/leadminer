import { Token } from 'simple-oauth2';
import util from 'util';
import ENV from '../config';
import {
  OAuthMiningSourceCredentials,
  OAuthMiningSourceProvider
} from '../db/interfaces/MiningSources';
import { ContactFormat } from '../services/extractors/engines/FileImport';
import azureOAuth2Client from '../services/OAuth2/azure';
import googleOAuth2Client from '../services/OAuth2/google';
import logger from '../utils/logger';

const providerScopes = {
  google: {
    scopes: [
      'openid',
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/contacts'
    ],
    requiredScopes: [
      'openid',
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/contacts'
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
    prompt: 'consent select_account'
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
    // skipcq: JS-R1002 - instantiating unused object as the url validity checker
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates the contacts data with throwing an error if the data is invalid.
 * @param contacts The contacts data extracted from a file.
 */
export function validateFileContactsData(
  contacts: Partial<ContactFormat[]>
): void {
  if (!contacts.length) {
    throw new Error('No contacts found in the in the contacts data');
  }
  contacts.forEach((contact) => {
    if (!contact) {
      throw new Error('Empty contact found in the contacts data');
    }

    if (isInvalidEmail(contact.email)) {
      throw new Error('Invalid email found in the contacts data');
    }

    const URL_LIST = [contact.image?.split(','), contact.same_as?.split(',')]
      .map((list) => list?.map((url) => url.trim()).filter(Boolean))
      .filter((list) => list?.length);
    URL_LIST.forEach((list) => {
      if (list?.length && !list.every((url) => isValidURL(url))) {
        throw new Error('Invalid URL found in the contacts data');
      }
    });
  });
}
export async function refreshAccessToken(
  OAuthCredentials: OAuthMiningSourceCredentials
): Promise<Token> {
  try {
    const authClient = getAuthClient(OAuthCredentials.provider);

    const token = {
      access_token: OAuthCredentials.accessToken,
      refresh_token: OAuthCredentials.refreshToken,
      expires_at: OAuthCredentials.expiresAt
    };

    const tokenInstance = authClient.createToken(token);

    const refreshed = await tokenInstance.refresh();
    const refreshedToken = refreshed.token;

    return refreshedToken;
  } catch (error) {
    logger.error(
      'Failed to refresh access token',
      util.inspect(error, { depth: null, colors: true })
    );
    throw error;
  }
}
