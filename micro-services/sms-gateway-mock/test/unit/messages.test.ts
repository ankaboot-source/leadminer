/**
 * HTTP-level tests for GET/DELETE /messages route.
 * Ported from Deno test suite (tests 13-20).
 */
import { describe, expect, it, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from './_helpers/createTestApp';
import { resetState } from '../../../src/store/messageStore';

describe('GET /messages', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    resetState();
    app = createTestApp();
  });

  it('returns stored messages with pagination', async () => {
    const promises = [];
    for (let i = 0; i < 5; i += 1) {
      promises.push(
        request(app)
          .post('/simple-sms-gateway/send-sms')
          .send({ phone: `+3361234567${i}`, message: `Message ${i}` })
      );
    }
    await Promise.all(promises);

    const response = await request(app).get('/messages?limit=2&offset=1');

    expect(response.body.messages.length).toBe(2);
    expect(response.body.total).toBe(5);
    expect(response.body.limit).toBe(2);
    expect(response.body.offset).toBe(1);
  });

  it('filters by campaignId', async () => {
    await request(app)
      .post('/simple-sms-gateway/send-sms')
      .set('X-Campaign-Id', 'campaign-A')
      .send({ phone: '+33612345678', message: 'Msg A' });

    await request(app)
      .post('/simple-sms-gateway/send-sms')
      .set('X-Campaign-Id', 'campaign-B')
      .send({ phone: '+33612345679', message: 'Msg B' });

    const response = await request(app).get('/messages?campaignId=campaign-A');

    expect(response.body.messages.length).toBe(1);
    expect(response.body.messages[0].campaignId).toBe('campaign-A');
  });

  it('filters by provider', async () => {
    await request(app)
      .post('/simple-sms-gateway/send-sms')
      .send({ phone: '+33612345678', message: 'Simple' });

    const credentials = Buffer.from('user:pass').toString('base64');
    await request(app)
      .post('/smsgate/send-sms')
      .set('Authorization', `Basic ${credentials}`)
      .send({
        textMessage: { text: 'SMSGate' },
        phoneNumbers: ['+33612345679']
      });

    const response = await request(app).get('/messages?provider=smsgate');

    expect(response.body.messages.length).toBe(1);
    expect(response.body.messages[0].provider).toBe('smsgate');
  });

  it('?full=true requires valid X-Mock-Token', async () => {
    await request(app)
      .post('/simple-sms-gateway/send-sms')
      .send({ phone: '+33612345678', message: 'Hello' });

    // Without token
    let response = await request(app).get('/messages?full=true');
    expect(response.status).toBe(401);

    // With wrong token
    response = await request(app)
      .get('/messages?full=true')
      .set('X-Mock-Token', 'wrong-token');
    expect(response.status).toBe(401);
  });

  it('?full=true with correct token returns unredacted data', async () => {
    await request(app)
      .post('/simple-sms-gateway/send-sms')
      .send({ phone: '+33612345678', message: 'Hello' });

    const response = await request(app)
      .get('/messages?full=true')
      .set('X-Mock-Token', 'test-mock-token');

    expect(response.body.messages[0].phone).toBe('+33612345678');
  });

  it('default redaction masks phone and truncates body', async () => {
    await request(app).post('/simple-sms-gateway/send-sms').send({
      phone: '+33612345678',
      message:
        'This is a very long message that exceeds fifty characters for testing truncation'
    });

    const response = await request(app).get('/messages');
    const msg = response.body.messages[0];

    expect(msg.phone).toMatch(/^\+336\*\*\*\*\*\*78$/);
    expect(msg.body).toMatch(/^.{0,50}\.\.\.$/);
  });

  it('filters by phone', async () => {
    await request(app)
      .post('/simple-sms-gateway/send-sms')
      .send({ phone: '+33612345678', message: 'Msg A' });

    await request(app)
      .post('/simple-sms-gateway/send-sms')
      .send({ phone: '+33612345679', message: 'Msg B' });

    const response = await request(app).get('/messages?phone=%2B33612345678');

    expect(response.body.messages.length).toBe(1);
  });

  it('DELETE /messages: clears all stored messages', async () => {
    await request(app)
      .post('/simple-sms-gateway/send-sms')
      .send({ phone: '+33612345678', message: 'Hello' });

    let response = await request(app).get('/messages');
    expect(response.body.total).toBe(1);

    response = await request(app).delete('/messages');
    expect(response.status).toBe(200);

    response = await request(app).get('/messages');
    expect(response.body.total).toBe(0);
  });
});
