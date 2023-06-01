import { describe, expect, it, jest } from '@jest/globals';
import ProviderPool, {
  ProviderConfig,
  ProviderName
} from '../../src/services/auth/Provider';

jest.mock('../../src/config', () => {});

describe('ProviderPool', () => {
  const mockOAuthConfig = {
    issuerURL: 'test',
    authorizationURL: 'test',
    userInfoURL: 'test',
    jwkURI: 'test',
    tokenURL: 'test',
    clientID: 'test',
    clientSecret: 'test',
    scopes: ['test']
  };
  const mockImapConfig = {
    name: 'test',
    host: 'test',
    port: 993
  };

  const google: ProviderName = 'google';
  const azure: ProviderName = 'azure';

  const providersConfig: ProviderConfig[] = [
    {
      name: google,
      oauthConfig: mockOAuthConfig,
      imapConfig: mockImapConfig,
      domains: ['domain1', 'domain2']
    },
    {
      name: azure,
      oauthConfig: mockOAuthConfig,
      imapConfig: mockImapConfig,
      domains: ['domain3']
    }
  ];

  describe('oAuthClientFor', () => {
    it('should return an instance of OAuthClient for valid provider name', () => {
      const pool = new ProviderPool(providersConfig);
      const client = pool.oAuthClientFor({ name: 'google' });

      expect(client).toBeDefined();
    });

    it('should return an instance of OAuthClient for valid email domain', () => {
      const pool = new ProviderPool(providersConfig);
      const client = pool.oAuthClientFor({ email: 'test@domain2.com' });

      expect(client).toBeDefined();
    });

    it('should throw an error for invalid provider name', () => {
      const pool = new ProviderPool(providersConfig);

      expect(() => {
        pool.oAuthClientFor({ name: 'InvalidProvider' });
      }).toThrow(Error);
    });

    it('should throw an error for unsupported email domain', () => {
      const pool = new ProviderPool(providersConfig);

      expect(() => {
        pool.oAuthClientFor({ email: 'test@invalid.com' });
      }).toThrow(Error);
    });
  });

  describe('getProviderConfig', () => {
    it('should throw an error for invalid provider name', () => {
      const pool = new ProviderPool(providersConfig);

      expect(() => {
        pool.getProviderConfig({ name: 'InvalidProvider' });
      }).toThrow(Error);
    });

    it('should throw an error for unsupported email domain', () => {
      const pool = new ProviderPool(providersConfig);

      expect(() => {
        pool.getProviderConfig({ email: 'test@invalid.com' });
      }).toThrow(Error);
    });

    it('should return the configurations for a valid provider name', () => {
      const pool = new ProviderPool(providersConfig);
      const config = pool.getProviderConfig({ name: 'azure' });

      expect(config).toBeTruthy();
    });

    it('should return the configurations for a valid email domain', () => {
      const pool = new ProviderPool(providersConfig);
      const config = pool.getProviderConfig({ email: 'test@domain1.com' });

      expect(config).toBeTruthy();
    });
  });

  describe('supportedProviders', () => {
    it('returns the supported providers with their domain entries', () => {
      const pool = new ProviderPool(providersConfig);
      const supportedProviders = pool.supportedProviders();

      expect(supportedProviders).toEqual({
        google: ['domain1', 'domain2'],
        azure: ['domain3']
      });
    });

    it('returns an empty object when no providers are available', () => {
      const pool = new ProviderPool([]);
      const supportedProviders = pool.supportedProviders();

      expect(supportedProviders).toEqual({});
    });
  });
});
