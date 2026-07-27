import { describe, expect, it } from '@jest/globals';
import { startMiningSchema } from '../../../src/validators/mining.schema';

describe('startMiningSchema', () => {
  describe('boxes + googleContactsSync validation', () => {
    it('should accept boxes: [] when googleContactsSync: true', () => {
      const result = startMiningSchema.safeParse({
        params: { userId: 'user-1' },
        body: {
          miningSource: { email: 'test@example.com' },
          boxes: [],
          googleContactsSync: true,
          cleaningEnabled: false,
          extractSignatures: false
        }
      });
      expect(result.success).toBe(true);
    });

    it('should reject boxes: [] when googleContactsSync: false', () => {
      const result = startMiningSchema.safeParse({
        params: { userId: 'user-1' },
        body: {
          miningSource: { email: 'test@example.com' },
          boxes: [],
          googleContactsSync: false,
          cleaningEnabled: false,
          extractSignatures: false
        }
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('boxes');
      }
    });

    it('should reject boxes: [] when googleContactsSync is undefined', () => {
      const result = startMiningSchema.safeParse({
        params: { userId: 'user-1' },
        body: {
          miningSource: { email: 'test@example.com' },
          boxes: [],
          cleaningEnabled: false,
          extractSignatures: false
        }
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('boxes');
      }
    });

    it('should accept boxes: ["INBOX"] when googleContactsSync: true', () => {
      const result = startMiningSchema.safeParse({
        params: { userId: 'user-1' },
        body: {
          miningSource: { email: 'test@example.com' },
          boxes: ['INBOX'],
          googleContactsSync: true,
          cleaningEnabled: false,
          extractSignatures: false
        }
      });
      expect(result.success).toBe(true);
    });

    it('should accept boxes: ["INBOX"] when googleContactsSync: false', () => {
      const result = startMiningSchema.safeParse({
        params: { userId: 'user-1' },
        body: {
          miningSource: { email: 'test@example.com' },
          boxes: ['INBOX'],
          googleContactsSync: false,
          cleaningEnabled: false,
          extractSignatures: false
        }
      });
      expect(result.success).toBe(true);
    });
  });
});
