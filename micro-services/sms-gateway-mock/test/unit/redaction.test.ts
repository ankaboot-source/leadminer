/**
 * Unit tests for redaction utility functions.
 * Ported from Deno test suite (tests 46-51).
 * Test #46 is the CRITICAL Phase 1 remediation fix verification.
 */
import { describe, expect, it } from '@jest/globals';
import {
  redactPhone,
  redactBody,
  redactMessage
} from '../../../src/utils/redaction';
import type { StoredMessage } from '../../../src/types';

describe('redaction', () => {
  describe('redactPhone', () => {
    it('CRITICAL: masks middle digits for standard phone (Phase 1 fix)', () => {
      // This is the Phase 1 remediation fix verification
      expect(redactPhone('+33612345678')).toBe('+336******78');
    });

    it('returns short phone unchanged (length <= 4)', () => {
      expect(redactPhone('+33')).toBe('+33');
    });
  });

  describe('redactBody', () => {
    it('returns short body unchanged (length <= 50)', () => {
      expect(redactBody('short')).toBe('short');
    });

    it('truncates long body to 50 chars + ellipsis', () => {
      const longBody = 'x'.repeat(100);
      expect(redactBody(longBody)).toBe(`${'x'.repeat(50)}...`);
    });
  });

  describe('redactMessage', () => {
    const msg: StoredMessage = {
      id: 'msg-1',
      provider: 'simple-sms-gateway',
      phone: '+33612345678',
      body: 'This is a very long message that exceeds fifty characters for testing truncation',
      bodyLength: 87,
      timestamp: '2024-01-01T00:00:00.000Z',
      success: true,
      httpStatus: 200,
      durationMs: 10
    };

    it('full=true returns message unchanged', () => {
      const result = redactMessage(msg, true);
      expect(result).toEqual(msg);
    });

    it('full=false returns message with redacted phone and body', () => {
      const result = redactMessage(msg, false);
      expect(result.phone).toBe('+336******78');
      expect(result.body).toMatch(/^.{0,50}\.\.\.$/);
    });
  });
});
