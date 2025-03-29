import { describe, expect, it, jest } from '@jest/globals';
import { getOAuthImapConfigByEmail } from '../../src/services/auth/Provider';
import supabaseClient from '../../src/utils/supabase';

jest.mock('../../src/config', () => ({}));
jest.mock('../../src/utils/supabase', () => ({
  __esModule: true,
  default: {
    functions: {
      invoke: jest.fn()
    }
  }
}));

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

  it('Should call Supabase function for IMAP discovery for unknown domains', async () => {
    (supabaseClient.functions.invoke as jest.Mock).mockReturnValue({
      data: {
        host: 'imap.custom.com',
        port: 993,
        secure: true
      },
      error: null
    });

    const config = await getOAuthImapConfigByEmail('test@custom.com');
    expect(supabaseClient.functions.invoke as jest.Mock).toHaveBeenCalledWith(
      'imap?email=test@custom.com',
      {
        method: 'GET'
      }
    );
    expect(config).toEqual({
      host: 'imap.custom.com',
      port: 993,
      tls: true
    });
  });

  it('Should throw an error if Supabase function fails', async () => {
    (supabaseClient.functions.invoke as jest.Mock).mockReturnValue({
      data: null,
      error: true
    });

    await expect(getOAuthImapConfigByEmail('test@invalid.com')).rejects.toThrow(
      'Could not detect IMAP configuration for email: test@invalid.com'
    );
  });
});
