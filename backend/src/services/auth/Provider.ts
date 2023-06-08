import { Client, Issuer } from 'openid-client';
import ENV from '../../config';
import { IMAPConfig, OAuthConfig, ProviderConfig } from './types';

function getDomainFromEmail(email: string) {
  return email.split('@')[1]?.split('.')[0];
}

export class ConfigurationPool {
  private readonly PROVIDERS = new Map();

  private readonly PROVIDER_DOMAINS = new Map();

  /**
   * Creates a new instance of a ConfigurationPool.
   * @param name The name of the provider.
   * @param oauthConfig The OAuth configuration.
   * @param imapConfig The IMAP configuration.
   * @param domains The supported domains for the provider.
   */

  constructor(providersConfig: ProviderConfig[]) {
    for (const { name, oauthConfig, imapConfig, domains } of providersConfig) {
      domains.forEach((domain: string) => {
        this.PROVIDER_DOMAINS.set(domain, name);
      });
      this.PROVIDERS.set(name, { oauthConfig, imapConfig });
    }
  }

  /**
   * Creates an OAuth client based on the specified email or provider name.
   * @param lookupParams An object containing the lookup parameters.
   * @param lookupParams.email Used to lookup using email domain.
   * @param lookupParams.name  Used to lookup using provider name directly.
   * @param callbackURL - (optional) The callback URL the client will use for redirection after successful authentication.
   * @returns An instance of OAuthClient if the email's domain is supported or the provider name is valid, or null otherwise.
   * @throws Error if the provider name or provider is not found.
   */
  oAuthClientFor(
    { email, name }: { email?: string; name?: string },
    callbackURL?: string
  ): Client {
    let provider = null;

    if (name) {
      provider = this.PROVIDERS.get(name);
    } else if (email) {
      const emailDomain = getDomainFromEmail(email);
      const providerName = this.PROVIDER_DOMAINS.get(emailDomain);
      provider = this.PROVIDERS.get(providerName);
    }

    if (provider === null || provider === undefined) {
      throw new Error(`Provider not found using lookup=${name || email}`);
    }

    const { oauthConfig } = provider;
    const {
      issuerURL,
      authorizationURL,
      tokenURL,
      userInfoURL,
      jwkURI,
      clientID,
      clientSecret,
      redirectURI
    } = oauthConfig;

    const issuer = new Issuer({
      issuer: issuerURL,
      authorization_endpoint: authorizationURL,
      token_endpoint: tokenURL,
      userinfo_endpoint: userInfoURL,
      jwks_uri: jwkURI
    });

    const client = new issuer.Client({
      client_id: clientID,
      client_secret: clientSecret,
      redirect_uris: [callbackURL, redirectURI] || [],
      response_types: ['code']
    });

    if (!client) {
      throw new Error('Failed to create OAuth client.');
    }

    return client;
  }

  /**
   * Retrieves available configurations for a provider based on its email domain or name.
   * @param lookupParams An object containing the lookup parameters.
   * @param lookupParams.email Used to lookup using email domain.
   * @param lookupParams.name  Used to lookup using provider name directly.
   * @returns An object containing Available configurations of the provider.
   * @throws Error if the provider is not found.
   */
  getProviderConfig({ email, name }: { email?: string; name?: string }): {
    oauthConfig: OAuthConfig;
    imapConfig: IMAPConfig;
  } {
    let provider = null;

    if (name) {
      provider = this.PROVIDERS.get(name);
    } else if (email) {
      const domain = getDomainFromEmail(email);
      const lookup = this.PROVIDER_DOMAINS.get(domain);
      provider = this.PROVIDERS.get(lookup);
    }

    if (provider === null || provider === undefined) {
      throw new Error(`Provider not found using lookup=${name || email}`);
    }

    const { oauthConfig, imapConfig } = provider;
    return { oauthConfig, imapConfig };
  }

  /**
   * Retrieves the supported providers along with their corresponding domain entries.
   * @returns A JSON string representation of the supported providers and their domains.
   */
  supportedProviders(): Record<string, string[]> {
    const availableProviders = this.PROVIDER_DOMAINS.entries();

    if (availableProviders.next().done) {
      return {};
    }

    const providers: Record<string, string[]> = {};

    for (const [key, value] of this.PROVIDER_DOMAINS.entries()) {
      if (providers[value]) {
        providers[value].push(key);
      } else {
        providers[value] = [key];
      }
    }

    return providers;
  }
}

const providersConfigs: ProviderConfig[] = [
  {
    name: 'google',
    oauthConfig: {
      issuerURL: 'https://accounts.google.com',
      authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
      userInfoURL: 'https://openidconnect.googleapis.com/v1/userinfo',
      jwkURI: 'https://www.googleapis.com/oauth2/v3/certs',
      tokenURL: 'https://oauth2.googleapis.com/token',
      clientID: ENV.GOOGLE_CLIENT_ID,
      clientSecret: ENV.GOOGLE_SECRET,
      scopes: ['https://mail.google.com/']
    },
    imapConfig: {
      name: 'google',
      host: 'imap.gmail.com',
      port: 993
    },
    domains: ['gmail', 'googlemail', 'google']
  },
  {
    name: 'azure',
    oauthConfig: {
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
    },
    imapConfig: {
      name: 'azure',
      host: 'outlook.office365.com',
      port: 993
    },
    domains: ['outlook', 'hotmail', 'live', 'windowslive', 'dbmail', 'msn']
  }
];

const PROVIDER_POOL = new ConfigurationPool(providersConfigs);

export default PROVIDER_POOL;
