import { describe, expect, it, jest, test } from '@jest/globals';
import {
  findEmailAddressType,
  isNoReply,
  isTransactional
} from '../../src/utils/helpers/taggingHelpers';
import { getSpecificHeader } from '../../src/utils/helpers/emailHeaderHelpers';

jest.mock('../../src/config', () => {});

describe('emailHeaderHelpers.getSpecificHeader', () => {
  const TEST_HEADERS = {
    'delivered-to': [''],
    received: [''],
    'x-google-smtp-source': [''],
    'x-received': [''],
    'arc-seal': [''],
    'arc-message-signature': [''],
    'arc-authentication-results': [''],
    'return-path': ['', ''],
    'received-spf': ['']
  };

  it('Should return null when headers not present', () => {
    expect(
      getSpecificHeader(TEST_HEADERS, ['x-missing', 'x-missing-2'])
    ).toBeNull();
  });

  it('Should return value for existing header', () => {
    const header = {
      'delivered-to': 'testing',
      received: 'testing',
      'x-google-smtp-source': 'testing',
      'x-received': 'testing',
      'arc-seal': 'testing',
      'arc-message-signature': 'testing',
      'arc-authentication-results': 'testing',
      'return-path': 'testing',
      'received-spf': 'testing'
    };

    expect(getSpecificHeader(header, ['received-spf'])).toBe('testing');
    expect(getSpecificHeader(header, ['arc-seal'])).toBe('testing');
  });
});

describe('taggingHelpers.findEmailAddressType()', () => {
  it('should return "Professional" for custom domain type', () => {
    const type = findEmailAddressType('custom');
    expect(type).toBe('professional');
  });

  it('should return "Personal" for provider domain type', () => {
    const type = findEmailAddressType('provider');
    expect(type).toBe('personal');
  });
});

describe('taggingHelpers.isNoReply(emailAddress)', () => {
  it('should return true for no-reply-leadminer@leadminer.io', () => {
    const output = isNoReply('no-reply-leadminer@leadminer.io');
    expect(output).toBe(true);
  });

  it('should return false for leadminer@leadminer.io', () => {
    const output = isNoReply('leadminer@leadminer.com');
    expect(output).toBe(false);
  });
});

describe('taggingHelpers.isTransactional(emailAddress)', () => {
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
