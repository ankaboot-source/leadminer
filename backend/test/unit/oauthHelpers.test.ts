import { describe, expect, it, jest } from '@jest/globals';
import {
  buildEndpointURL,
  buildRedirectUrl
} from '../../src/utils/helpers/oauthHelpers';

jest.mock('../../src/config', () => {});

describe('buildEndpointURL', () => {
  it('should construct the full callback URL correctly', () => {
    const result = buildEndpointURL('http://example.com', '/api/callback');

    expect(result).toBe('http://example.com/api/callback');
  });
});

describe('buildRedirectUrl', () => {
  it('should build a redirect URL with query parameters', () => {
    const redirectURL = 'http://example.com/redirect';
    const params = {
      param1: 'value1',
      param2: 'value2'
    };
    const result = buildRedirectUrl(redirectURL, params);

    expect(result).toBe(
      'http://example.com/redirect?param1=value1&param2=value2'
    );
  });

  it('should throw an error for invalid redirectURL', () => {
    const redirectURL = 'invalid-url';
    const params = {
      param1: 'value1',
      param2: 'value2'
    };

    expect(() => {
      buildRedirectUrl(redirectURL, params);
    }).toThrow('Invalid redirectURL: Not a valid URL');
  });
});
