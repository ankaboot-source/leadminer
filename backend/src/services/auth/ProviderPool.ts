import ENV from '../../config';
import ProviderPool, { ProviderConfig } from './Provider';

const GOOGLE_OAUTH_CONFIG = {
  issuerURL: 'https://accounts.google.com',
  authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
  userInfoURL: 'https://openidconnect.googleapis.com/v1/userinfo',
  jwkURI: 'https://www.googleapis.com/oauth2/v3/certs',
  tokenURL: 'https://oauth2.googleapis.com/token',
  clientID: ENV.GOOGLE_CLIENT_ID,
  clientSecret: ENV.GOOGLE_SECRET,
  scopes: ['https://mail.google.com/']
};
const AZURE_OAUTH_CONFIG = {
  issuerURL:
    'https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0',
  authorizationURL:
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  userInfoURL: 'https://graph.microsoft.com/oidc/userinfo',
  jwkURI: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
  tokenURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  clientID: ENV.AZURE_CLIENT_ID,
  clientSecret: ENV.AZURE_SECRET,
  scopes: []
};
const providersConfigs: ProviderConfig[] = [
  {
    name: 'google',
    oauthConfig: GOOGLE_OAUTH_CONFIG,
    imapConfig: {
      name: 'google',
      host: 'imap.gmail.com',
      port: 993
    },
    domains: ['gmail', 'googlemail', 'google']
  },
  {
    name: 'azure',
    oauthConfig: AZURE_OAUTH_CONFIG,
    imapConfig: {
      name: 'azure',
      host: 'outlook.office365.com',
      port: 993
    },
    domains: ['outlook', 'hotmail', 'live', 'windowslive', 'dbmail', 'msn']
  }
];

const PROVIDER_POOL = new ProviderPool(providersConfigs);

export default PROVIDER_POOL;
