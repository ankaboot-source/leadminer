/**
 * HTTP-level tests for GET /health route.
 * Ported from Deno test suite (test 25).
 */
import { describe, expect, it, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from './_helpers/createTestApp';
import { resetState } from '../../../src/store/messageStore';

describe('GET /health', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    resetState();
    app = createTestApp();
  });

  it('returns status, config, and stats', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('sms-gateway-mock');
    expect(response.body.config).toBeDefined();
    expect(response.body.stats).toBeDefined();
    expect(typeof response.body.stats.totalMessages).toBe('number');
    expect(typeof response.body.stats.campaignsTracked).toBe('number');
  });
});
