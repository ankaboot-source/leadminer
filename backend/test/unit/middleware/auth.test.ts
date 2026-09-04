import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Request, Response } from 'express';

import ENV from '../../../src/config';
import initializeAuthMiddleware from '../../../src/middleware/auth';
import supabaseClient from '../../../src/utils/supabase';

jest.mock('../../../src/config', () => ({
  LEADMINER_API_HOST: 'leadminer-test.io',
  LEADMINER_API_LOG_LEVEL: 'error',
  SUPABASE_PROJECT_URL: 'fake',
  // Distinct sentinels only. The real values are long JWTs; these literals are
  // intentionally credential-free so the secrets analyzer doesn't flag them.
  SUPABASE_SECRET_PROJECT_TOKEN: 'legacy',
  SUPABASE_SERVICE_ROLE_KEY: 'edge'
}));

function mockSupabaseClient() {
  return {
    auth: {
      admin: {
        getUserById: jest.fn()
      }
    }
  };
}

jest.mock('../../../src/utils/supabase', () => mockSupabaseClient());

const authMiddleware = initializeAuthMiddleware({
  getAccessToken: () => null,
  getUser: () => Promise.resolve(null)
});

function mockResponse(): Response {
  const res = { locals: {} } as Response;
  res.status = jest.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = jest.fn().mockReturnValue(res) as unknown as Response['json'];
  return res;
}

function mockRequest(headers: Record<string, string>): Request {
  return {
    headers,
    query: { userId: 'userId-1' },
    params: {}
  } as unknown as Request;
}

describe('auth middleware service token acceptance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseClient.auth.admin.getUserById as jest.Mock).mockResolvedValue({
      data: { user: { id: 'userId-1', email: 'user@example.com' } }
    });
  });

  it('accepts the SUPABASE_SECRET_PROJECT_TOKEN (legacy)', async () => {
    const req = mockRequest({
      authorization: `Bearer ${ENV.SUPABASE_SECRET_PROJECT_TOKEN}`
    });
    let called = false;
    await authMiddleware(req, mockResponse(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('accepts the SUPABASE_SERVICE_ROLE_KEY (edge-function default)', async () => {
    const req = mockRequest({
      authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`
    });
    let called = false;
    await authMiddleware(req, mockResponse(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('rejects an arbitrary bearer token with 401', async () => {
    const req = mockRequest({ authorization: 'Bearer unknown-value' });
    let called = false;
    const res = mockResponse();
    await authMiddleware(req, res, () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
