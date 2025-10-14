import { describe, expect, it, jest } from '@jest/globals';
import { getTokenConfig } from '../../../src/controllers/mining.helpers';
import { OAuthMiningSourceProvider } from '../../../src/db/interfaces/MiningSources';

jest.mock('../../../src/config', () => ({
  LEADMINER_API_HOST: 'https://example.com'
}));

describe('getTokenConfig', () => {
  it('should return the correct config for Google with offline access_type', () => {
    const provider: OAuthMiningSourceProvider = 'google';
    const result = getTokenConfig(provider);

    expect(result).toEqual({
      redirect_uri: 'https://example.com/api/imap/mine/sources/google/callback',
      scope: [
        'openid',
        'https://mail.google.com/',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      prompt: 'consent select_account',
      access_type: 'offline'
    });
  });

  it('should return the correct config for Azure without offline access_type', () => {
    const provider: OAuthMiningSourceProvider = 'azure';
    const result = getTokenConfig(provider);

    expect(result).toEqual({
      redirect_uri: 'https://example.com/api/imap/mine/sources/azure/callback',
      scope: [
        'https://outlook.office.com/IMAP.AccessAsUser.All',
        'offline_access',
        'email',
        'openid',
        'profile'
      ],
      prompt: 'consent select_account'
    });
  });
});
