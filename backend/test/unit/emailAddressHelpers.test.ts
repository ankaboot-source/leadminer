import { describe, expect, it, test } from '@jest/globals';

import {
  findEmailAddressType,
  isNoReply,
  isTransactional
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

describe('emailAddressHelpers.isTransactional(emailAddress)', () => {
  test.each`
    input
    ${'reply+ABOE2A5ILHXMYEL3KF74W5OCOJCEREVBNHHGMLYEUE@reply.github.com'}
    ${'leadminer@noreply.github.com'}
    ${'subscribed@noreply.github.com'}
    ${'unsub+ABOE2A5ILHXMYEL3KF74W5OCOJCEREVBNHHGMLYEUE@reply.github.com'}
  `('Should tag $input email address as transactional', ({ input }) => {
    expect(isTransactional(input)).toBe(true);
  });
});
