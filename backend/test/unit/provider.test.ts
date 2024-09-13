import { describe, expect, it } from '@jest/globals';
import { getOAuthImapConfigByEmail } from '../../src/services/auth/Provider';

describe('getOAuthImapConfigByEmail', () => {
  it('Should throw an error for unsupported email domain', () => {
    expect(() => {
      getOAuthImapConfigByEmail('test@invalid.com');
    }).toThrow(Error);
  });

  it('Should return the imap config for a supported email domain', () => {
    expect(getOAuthImapConfigByEmail('test@gmail.com')).toEqual({
      tls: true,
      host: 'imap.gmail.com',
      port: 993
    });

    expect(getOAuthImapConfigByEmail('test@outlook.com')).toEqual({
      host: 'outlook.office365.com',
      tls: true,
      port: 993
    });
  });
});
