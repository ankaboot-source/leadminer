/**
 * HTTP-level tests for POST /config route.
 * Ported from Deno test suite (tests 21-24).
 */
import { describe, expect, it, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from './_helpers/createTestApp';
import { resetState } from '../../../src/store/messageStore';

describe('POST /config', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    resetState();
    app = createTestApp();
  });

  it('per-provider override changes behavior', async () => {
    await request(app)
      .post('/config')
      .send({
        providers: {
          smsgate: {
            successRate: 0,
            failStatusCode: 429,
            failMessage: 'SMSGate overloaded'
          }
        }
      });

    const credentials = Buffer.from('user:pass').toString('base64');
    const response = await request(app)
      .post('/smsgate/send-sms')
      .set('Authorization', `Basic ${credentials}`)
      .send({ textMessage: { text: 'Hello' }, phoneNumbers: ['+33612345678'] });

    expect(response.status).toBe(429);
    expect(response.body.message).toBe('SMSGate overloaded');
  });

  it('global config update', async () => {
    const response = await request(app)
      .post('/config')
      .send({ global: { successRate: 0.5, delayMs: 100 } });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.config.global.successRate).toBe(0.5);
    expect(response.body.config.global.delayMs).toBe(100);
  });

  it('invalid body returns 400', async () => {
    const response = await request(app)
      .post('/config')
      .send({ global: { successRate: 2.0 } });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it('deep merge preserves unspecified fields', async () => {
    await request(app)
      .post('/config')
      .send({ global: { successRate: 0.5 } });

    await request(app)
      .post('/config')
      .send({ global: { delayMs: 100 } });

    const healthRes = await request(app).get('/health');
    expect(healthRes.body.config.global.successRate).toBe(0.5);
    expect(healthRes.body.config.global.delayMs).toBe(100);
  });
});
