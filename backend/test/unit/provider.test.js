import { describe, it, expect } from '@jest/globals';
import ProviderPool from '../../src/services/Provider';

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

  const providersConfig = [
    {
      name: 'Provider1',
      oauthConfig: mockOAuthConfig,
      imapConfig: mockImapConfig,
      domains: ['domain1', 'domain2']
    },
    {
      name: 'Provider2',
      oauthConfig: mockOAuthConfig,
      imapConfig: mockImapConfig,
      domains: ['domain3']
    }
  ];

  describe('oauthClientFor', () => {
    it('should return an instance of OAuthClient for valid provider name', () => {
      const pool = new ProviderPool(providersConfig);
      const client = pool.oauthClientFor({ name: 'Provider1' });

      expect(client).toBeDefined();
    });

    it('should return an instance of OAuthClient for valid email domain', () => {
      const pool = new ProviderPool(providersConfig);
      const client = pool.oauthClientFor({ email: 'test@domain2.com' });

      expect(client).toBeDefined();
    });

    it('should throw an error for invalid provider name', () => {
      const pool = new ProviderPool(providersConfig);

      expect(() => {
        pool.oauthClientFor({ name: 'InvalidProvider' });
      }).toThrow(Error);
    });

    it('should throw an error for unsupported email domain', () => {
      const pool = new ProviderPool(providersConfig);

      expect(() => {
        pool.oauthClientFor({ email: 'test@invalid.com' });
      }).toThrow(Error);
    });
  });

  describe('getProviderConfig', () => {
    it('should return the configurations for a valid provider name', () => {
      const pool = new ProviderPool(providersConfig);
      const config = pool.getProviderConfig({ name: 'Provider2' });

      expect(config).toEqual({
        oauthConfig: expect.any(Object),
        imapConfig: expect.any(Object)
      });
      // Add more assertions for the configurations if needed
    });

    it('returns the configurations for a valid email domain', () => {
      const pool = new ProviderPool(providersConfig);
      const config = pool.getProviderConfig({ email: 'test@domain1.com' });

      expect(config).toEqual({
        oauthConfig: expect.any(Object),
        imapConfig: expect.any(Object)
      });
      // Add more assertions for the configurations if needed
    });

    it('throws an error for invalid provider name', () => {
      const pool = new ProviderPool(providersConfig);

      expect(() => {
        pool.getProviderConfig({ name: 'InvalidProvider' });
      }).toThrow(Error);
    });

    it('throws an error for unsupported email domain', () => {
      const pool = new ProviderPool(providersConfig);

      expect(() => {
        pool.getProviderConfig({ email: 'test@invalid.com' });
      }).toThrow(Error);
    });
  });

  describe('supportedProviders', () => {
    it('returns the supported providers with their domain entries', () => {
      const pool = new ProviderPool(providersConfig);
      const supportedProviders = pool.supportedProviders();

      expect(supportedProviders).toEqual({
        Provider1: ['domain1', 'domain2'],
        Provider2: ['domain3']
      });
    });

    it('returns an empty object when no providers are available', () => {
      const pool = new ProviderPool([]);
      const supportedProviders = pool.supportedProviders();

      expect(supportedProviders).toEqual({});
    });
  });
});
