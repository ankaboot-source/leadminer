import { describe, expect, it } from '@jest/globals';
import { startMiningSchema } from '../../../src/validators/mining.schema';

const baseBody = {
  miningSource: { email: 'test@example.com' },
  boxes: ['INBOX'],
  googleContactsSync: false,
  cleaningEnabled: false,
  extractSignatures: false
};

describe('startMiningSchema', () => {
  describe('boxes + googleContactsSync validation', () => {
    it('should accept boxes: [] when googleContactsSync: true', () => {
      const result = startMiningSchema.safeParse({
        params: { userId: 'user-1' },
        body: { ...baseBody, boxes: [], googleContactsSync: true }
      });
      expect(result.success).toBe(true);
    });

    it('should reject boxes: [] when googleContactsSync: false', () => {
      const result = startMiningSchema.safeParse({
        params: { userId: 'user-1' },
        body: { ...baseBody, boxes: [] }
      });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0].path).toContain('boxes');
    });

    it('should reject boxes: [] when googleContactsSync is undefined', () => {
      const result = startMiningSchema.safeParse({
        params: { userId: 'user-1' },
        body: { ...baseBody, boxes: [], googleContactsSync: undefined }
      });
      expect(result.success).toBe(false);
    });

    it('should accept non-empty boxes with or without Google Contacts sync', () => {
      expect(
        startMiningSchema.safeParse({
          params: { userId: 'user-1' },
          body: baseBody
        }).success
      ).toBe(true);
      expect(
        startMiningSchema.safeParse({
          params: { userId: 'user-1' },
          body: { ...baseBody, googleContactsSync: true }
        }).success
      ).toBe(true);
    });
  });

  describe('explicit run mode', () => {
    it('defaults to full and rejects `since` in full mode', () => {
      const result = startMiningSchema.safeParse({
        params: { userId: 'user-1' },
        body: { ...baseBody, since: '2026-09-01' }
      });
      expect(result.success).toBe(false);
    });

    it('accepts `since` only for incremental mode', () => {
      expect(
        startMiningSchema.safeParse({
          params: { userId: 'user-1' },
          body: { ...baseBody, miningMode: 'incremental', since: '2026-09-01' }
        }).success
      ).toBe(true);
    });
  });
});
