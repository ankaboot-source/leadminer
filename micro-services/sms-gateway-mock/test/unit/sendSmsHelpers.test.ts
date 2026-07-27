/**
 * Unit tests for sendSmsHelpers.ts pure functions.
 * Ported from Deno test suite (tests 26-38).
 */
import { describe, expect, it } from '@jest/globals';
import {
  validateProvider,
  validateSmsgateAuth,
  extractPayload,
  recordSimulatedMessage
} from '../../../src/routes/sendSmsHelpers';
import { defaultGlobalConfig } from '../../../src/store/messageStore';

describe('sendSmsHelpers', () => {
  describe('validateProvider', () => {
    it('returns "simple-sms-gateway" for valid provider', () => {
      expect(validateProvider('simple-sms-gateway')).toBe('simple-sms-gateway');
    });

    it('returns "smsgate" for valid provider', () => {
      expect(validateProvider('smsgate')).toBe('smsgate');
    });

    it('returns null for unknown provider', () => {
      expect(validateProvider('unknown')).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(validateProvider(undefined)).toBeNull();
    });
  });

  describe('validateSmsgateAuth', () => {
    it('returns null for undefined', () => {
      expect(validateSmsgateAuth(undefined)).toBeNull();
    });

    it('returns null for Bearer token', () => {
      expect(validateSmsgateAuth('Bearer xyz')).toBeNull();
    });

    it('returns credentials for valid Basic auth', () => {
      const credentials = Buffer.from('user:pass').toString('base64');
      expect(validateSmsgateAuth(`Basic ${credentials}`)).toEqual({
        username: 'user',
        password: 'pass'
      });
    });
  });

  describe('extractPayload', () => {
    it('simple-sms-gateway: valid payload', () => {
      const result = extractPayload('simple-sms-gateway', {
        phone: '+33',
        message: 'hi'
      });
      expect(result).toEqual({ ok: true, phone: '+33', message: 'hi' });
    });

    it('simple-sms-gateway: missing message', () => {
      const result = extractPayload('simple-sms-gateway', { phone: '+33' });
      expect(result.ok).toBe(false);
      expect(result.error.status).toBe(400);
      expect(result.error.message).toContain('phone');
    });

    it('smsgate: valid payload', () => {
      const result = extractPayload('smsgate', {
        textMessage: { text: 'hi' },
        phoneNumbers: ['+33']
      });
      expect(result).toEqual({ ok: true, phone: '+33', message: 'hi' });
    });

    it('smsgate: wrong body format', () => {
      const result = extractPayload('smsgate', { phone: '+33' });
      expect(result.ok).toBe(false);
      expect(result.error.status).toBe(400);
    });
  });

  describe('recordSimulatedMessage', () => {
    it('with success: false returns StoredMessage with failure fields', () => {
      const result = recordSimulatedMessage({
        provider: 'simple-sms-gateway',
        phone: '+33612345678',
        message: 'Hello',
        messageLength: 5,
        campaignId: 'campaign-123',
        timestamp: '2024-01-01T00:00:00.000Z',
        durationMs: 100,
        success: false,
        cfg: defaultGlobalConfig,
        messageId: undefined
      });

      expect(result.success).toBe(false);
      expect(result.provider).toBe('simple-sms-gateway');
      expect(result.phone).toBe('+33612345678');
      expect(result.body).toBe('Hello');
      expect(result.campaignId).toBe('campaign-123');
      expect(result.httpStatus).toBe(defaultGlobalConfig.failStatusCode);
      expect(result.id).toBeDefined(); // UUID for failures
    });

    it('with success: true and messageId returns providerMessageId', () => {
      const result = recordSimulatedMessage({
        provider: 'simple-sms-gateway',
        phone: '+33612345678',
        message: 'Hello',
        messageLength: 5,
        campaignId: 'campaign-123',
        timestamp: '2024-01-01T00:00:00.000Z',
        durationMs: 100,
        success: true,
        cfg: defaultGlobalConfig,
        messageId: 'mock_1'
      });

      expect(result.success).toBe(true);
      expect(result.providerMessageId).toBe('mock_1');
      expect(result.id).toBe('mock_1');
    });
  });
});
