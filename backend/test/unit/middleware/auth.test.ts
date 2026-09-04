import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Response } from 'express';

jest.mock('../../../src/config', () => ({
  LEADMINER_API_HOST: 'leadminer-test.io',
  LEADMINER_API_LOG_LEVEL: 'error',
  SUPABASE_PROJECT_URL: 'fake',
  // NOTE: these two are intentionally DIFFERENT to prove the middleware accepts
  // both the legacy project token and the service role key.
  SUPABASE_SECRET_PROJECT_TOKEN: 'project-token',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
}));

const adminGetUserById = jest.fn();
jest.mock('../../../src/utils/supabase', () => ({
  auth: {
    admin: {
      getUserById: adminGetUserById
    }
  }
}));

import initializeAuthMiddleware from '../../../src/middleware/auth';
import ENV from '../../../src/config';

const authMiddleware = initializeAuthMiddleware({
  getAccessToken: () => null,
  getUser: async () => null
});

function mockRes() {
  const res: Record<string, any> = { locals: {} };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as unknown as Response;
}

describe('auth middleware service token acceptance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adminGetUserById.mockResolvedValue({
      data: { user: { id: 'userId-1', email: 'user@example.com' } }
    });
  });

  it('accepts the SUPABASE_SECRET_PROJECT_TOKEN (legacy)', async () => {
    const req = {
      headers: {
        authorization: `Bearer ${ENV.SUPABASE_SECRET_PROJECT_TOKEN}`
      },
      query: { userId: 'userId-1' },
      params: {}
    };
    let called = false;
    await authMiddleware(req as any, mockRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('accepts the SUPABASE_SERVICE_ROLE_KEY (edge-function default)', async () => {
    const req = {
      headers: { authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}` },
      query: { userId: 'userId-1' },
      params: {}
    };
    let called = false;
    await authMiddleware(req as any, mockRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('rejects an arbitrary bearer token with 401', async () => {
    const req = {
      headers: { authorization: 'Bearer some-garbage-token' },
      query: { userId: 'userId-1' },
      params: {}
    };
    let called = false;
    const res = mockRes();
    await authMiddleware(req as any, res, () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});