/**
 * HTTP-level tests for POST /:provider/send-sms route.
 * Ported from Deno test suite (tests 1-12).
 */
import { describe, expect, it, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from './_helpers/createTestApp';
import { resetState } from '../../../src/store/messageStore';

describe('POST /:provider/send-sms', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    resetState();
    app = createTestApp();
  });

  it('simple-sms-gateway: rejects missing phone', async () => {
    const response = await request(app)
      .post('/simple-sms-gateway/send-sms')
      .send({ message: 'Hello' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('phone');
  });

  it('simple-sms-gateway: rejects missing message', async () => {
    const response = await request(app)
      .post('/simple-sms-gateway/send-sms')
      .send({ phone: '+33612345678' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('simple-sms-gateway: returns success with sequential ID', async () => {
    const res1 = await request(app)
      .post('/simple-sms-gateway/send-sms')
      .send({ phone: '+33612345678', message: 'Hello' });

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.id ?? res1.body.messageId).toBe('mock_1');

    const res2 = await request(app)
      .post('/simple-sms-gateway/send-sms')
      .send({ phone: '+33612345679', message: 'Hello 2' });

    expect(res2.body.id ?? res2.body.messageId).toBe('mock_2');
  });

  it('simple-sms-gateway: returns failure based on successRate', async () => {
    // Set successRate to 0 to always fail
    await request(app)
      .post('/config')
      .send({ global: { successRate: 0.0, failStatusCode: 500 } });

    const response = await request(app)
      .post('/simple-sms-gateway/send-sms')
      .send({ phone: '+33612345678', message: 'Hello' });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Mock gateway error');
  });

  it('simple-sms-gateway: X-Campaign-Id header stored in message', async () => {
    const campaignId = '550e8400-e29b-41d4-a716-446655440000';
    await request(app)
      .post('/simple-sms-gateway/send-sms')
      .set('X-Campaign-Id', campaignId)
      .send({ phone: '+33612345678', message: 'Hello' });

    const listRes = await request(app)
      .get('/messages?full=true')
      .set('X-Mock-Token', 'test-mock-token');

    const msg = listRes.body.messages.find(
      (m: { phone: string }) => m.phone === '+33612345678'
    );
    expect(msg).toBeDefined();
    expect(msg.campaignId).toBe(campaignId);
  });

  it('smsgate: rejects unknown provider with 404', async () => {
    const response = await request(app)
      .post('/unknown-provider/send-sms')
      .send({ phone: '+33612345678', message: 'Hello' });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/Unknown provider/);
  });

  it('smsgate: missing Basic Auth returns 401', async () => {
    const response = await request(app)
      .post('/smsgate/send-sms')
      .send({ textMessage: { text: 'Hello' }, phoneNumbers: ['+33612345678'] });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/Authorization/);
  });

  it('smsgate: valid Basic Auth proceeds with request', async () => {
    const credentials = Buffer.from('user:pass').toString('base64');
    const response = await request(app)
      .post('/smsgate/send-sms')
      .set('Authorization', `Basic ${credentials}`)
      .send({
        textMessage: { text: 'Hello from smsgate' },
        phoneNumbers: ['+33612345678']
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.id).toBeDefined();
    expect(response.body.messageId).toBeDefined();
  });

  it('smsgate: wrong body format returns 400', async () => {
    const credentials = Buffer.from('user:pass').toString('base64');
    const response = await request(app)
      .post('/smsgate/send-sms')
      .set('Authorization', `Basic ${credentials}`)
      .send({ phone: '+33612345678', message: 'Hello' }); // wrong format

    expect(response.status).toBe(400);
  });

  it('smsgate: 3rdparty/v1/messages route also works', async () => {
    const credentials = Buffer.from('user:pass').toString('base64');
    const response = await request(app)
      .post('/smsgate/3rdparty/v1/messages')
      .set('Authorization', `Basic ${credentials}`)
      .send({ textMessage: { text: 'Hello' }, phoneNumbers: ['+33612345678'] });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('handles delayMs configuration', async () => {
    await request(app)
      .post('/config')
      .send({ global: { delayMs: 50 } });

    const start = Date.now();
    await request(app)
      .post('/simple-sms-gateway/send-sms')
      .send({ phone: '+33612345678', message: 'Hello' });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(50);
  });

  it('stores failure messages too', async () => {
    await request(app)
      .post('/config')
      .send({ global: { successRate: 0.0 } });

    await request(app)
      .post('/simple-sms-gateway/send-sms')
      .send({ phone: '+33612345678', message: 'Hello' });

    const listRes = await request(app)
      .get('/messages')
      .set('X-Mock-Token', 'test-mock-token');

    expect(listRes.body.total).toBeGreaterThan(0);
    const failedMsg = listRes.body.messages.find(
      (m: { success: boolean }) => m.success === false
    );
    expect(failedMsg).toBeDefined();
  });
});
