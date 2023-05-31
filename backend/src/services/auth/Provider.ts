import { Client, Issuer } from 'openid-client';

function getDomainFromEmail(email: string) {
  return email.split('@')[1]?.split('.')[0];
}

/**
 * Configuration object for OAuth.
 */
interface OAuthConfig {
  issuerURL: string;
  authorizationURL: string;
  userInfoURL: string;
  jwkURI: string;
  tokenURL: string;
  clientID: string;
  clientSecret: string;
  redirectURI?: string[];
  scopes?: string[];
}

/**
 * Configuration object for IMAP.
 */
interface IMAPConfig {
  name: string;
  host: string;
  port: number;
}

/**
 * Enum representing provider names.
 */
export type ProviderName = 'google' | 'azure';

export interface ProviderConfig {
  name: ProviderName;
  oauthConfig: OAuthConfig;
  imapConfig: IMAPConfig;
  domains: string[];
}

export default class ProviderPool {
  private readonly PROVIDERS = new Map();

  private readonly PROVIDER_DOMAINS = new Map();

  /**
   * Creates a new instance of a Provider.
   * @param name The name of the provider.
   * @param oauthConfig The OAuth configuration.
   * @param imapConfig The IMAP configuration.
   * @param domains The supported domains for the provider.
   */
  constructor(providersConfig: ProviderConfig[]) {
    for (const { name, oauthConfig, imapConfig, domains } of providersConfig) {
      domains.forEach((domain) => {
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
