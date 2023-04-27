import { describe, expect, it } from '@jest/globals';

import {
  findEmailAddressType,
  isNoReply
} from '../../src/utils/helpers/emailAddressHelpers';

describe('emailAddressHelpers.findEmailAddressType()', () => {
  it('should return "Professional" for custom domain type', () => {
    const type = findEmailAddressType('custom');
    expect(type).toBe('professional');
  });

  it('should return "Personal" for provider domain type', () => {
    const type = findEmailAddressType('provider');
    expect(type).toBe('personal');
  });

  it('should return an empty string for invalid input', () => {
    const type = findEmailAddressType('invalid-provider');
    expect(type).toBe('');
  });
});

describe('emailAddressHelpers.isNoReply(emailAddress)', () => {
  it('should return true for no-reply-leadminer@leadminer.io', () => {
    const output = isNoReply('no-reply-leadminer@leadminer.io');
    expect(output).toBe(true);
  });

  it('should return false for leadminer@leadminer.io', () => {
    const output = isNoReply('leadminer@leadminer.com');
    expect(output).toBe(false);
  });
});
