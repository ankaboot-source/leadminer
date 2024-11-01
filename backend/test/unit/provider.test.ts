import { describe, expect, it, jest } from '@jest/globals';
import IMAPSettingsDetector from '@ankaboot.io/imap-autoconfig';
import { getOAuthImapConfigByEmail } from '../../src/services/auth/Provider';

jest.mock('@ankaboot.io/imap-autoconfig');

describe('getOAuthImapConfigByEmail', () => {
  it('Should return the imap config for a supported email domain', async () => {
    expect(await getOAuthImapConfigByEmail('test@gmail.com')).toEqual({
      tls: true,
      host: 'imap.gmail.com',
      port: 993
    });

    expect(await getOAuthImapConfigByEmail('test@outlook.com')).toEqual({
      host: 'outlook.office365.com',
      tls: true,
      port: 993
    });
  });

  it('Should use auto-discovery to get IMAP config for supported domains not in PROVIDER_CONFIG', async () => {
    const mockDetect = jest.fn().mockReturnValue({
      host: 'imap.custom.com',
      port: 993,
      secure: true
    });

    (IMAPSettingsDetector as jest.Mock).mockImplementation(() => ({
      detect: mockDetect
    }));

    const config = await getOAuthImapConfigByEmail('test@custom.com');
    expect(mockDetect).toHaveBeenCalledWith('test@custom.com', 'test');
    expect(config).toEqual({
      host: 'imap.custom.com',
      port: 993,
      tls: true
    });
  });

  it('Should throw an error for unsupported email domain', async () => {
    const mockDetect = jest.fn().mockReturnValue(null);
    (IMAPSettingsDetector as jest.Mock).mockImplementation(() => ({
      detect: mockDetect
    }));

    await expect(getOAuthImapConfigByEmail('test@invalid.com')).rejects.toThrow(
      'Could not detect IMAP configuration for email: test@invalid.com'
    );
  });
});
