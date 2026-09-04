import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Request, Response } from 'express';

import initializeImapController from '../../../src/controllers/imap.controller';
import ImapConnectionProvider from '../../../src/services/imap/ImapConnectionProvider';
import { ImapAuthError } from '../../../src/utils/errors';

jest.mock('../../../src/config', () => ({
  SUPABASE_PROJECT_URL: 'http://localhost:54321',
  SUPABASE_SECRET_PROJECT_TOKEN: 'fake',
  LEADMINER_API_LOG_LEVEL: 'error'
}));

jest.mock('../../../src/utils/supabase', () => ({
  auth: {
    admin: {
      getUserById: jest.fn()
    }
  }
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../src/services/imap/ImapConnectionProvider', () => ({
  getSingleConnection: jest.fn()
}));

jest.mock('../../../src/services/imap/ImapBoxesFetcher', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => ({
      getTree: jest.fn().mockImplementation(() => {
        const e = new Error('AUTHENTICATIONFAILED');
        (e as Error & { code?: string }).code = 'AUTHENTICATIONFAILED';
        throw e;
      })
    }))
}));

function mockResponse() {
  const res = {
    locals: { user: { id: 'userId-1' } }
  } as Response;
  res.status = jest.fn().mockReturnValue(res) as unknown as Response['status'];
  res.send = jest.fn().mockReturnValue(res) as unknown as Response['send'];
  res.json = jest.fn().mockReturnValue(res) as unknown as Response['json'];
  return res;
}

function mockRequest(email: string): Request {
  return { body: { email } } as unknown as Request;
}

describe('getImapBoxes', () => {
  const getSourcesForUser = jest.fn();

  const miningSourceService = { getSourcesForUser };

  const controller = initializeImapController(miningSourceService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    (ImapConnectionProvider.getSingleConnection as jest.Mock).mockResolvedValue(
      { logout: jest.fn() }
    );
  });

  it('returns a clear reauth message when OAuth IMAP auth fails with 401', async () => {
    getSourcesForUser.mockResolvedValue([
      {
        email: 'oauth@example.com',
        type: 'google',
        credentials: { accessToken: 'token', email: 'oauth@example.com' }
      }
    ]);

    const res = mockResponse();
    await controller.getImapBoxes(
      mockRequest('oauth@example.com'),
      res,
      jest.fn() as never
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({
      data: { message: 'OAuth connection needs re-authentication' }
    });
  });

  it('passes through the generated ImapAuthError for a plain IMAP source 401', async () => {
    getSourcesForUser.mockResolvedValue([
      {
        email: 'imap@example.com',
        type: 'imap',
        credentials: {
          email: 'imap@example.com',
          password: 'secret',
          host: 'imap.example.com',
          port: 993,
          tls: true
        }
      }
    ]);

    const res = mockResponse();
    await controller.getImapBoxes(
      mockRequest('imap@example.com'),
      res,
      jest.fn() as never
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith(expect.any(ImapAuthError));
  });
});