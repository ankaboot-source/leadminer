import { jest, describe, expect, it } from '@jest/globals';
import { Request } from 'express';
import {
  buildEndpointURL,
  buildRedirectUrl
} from '../../src/utils/helpers/oauthHelpers';

describe('buildEndpointURL', () => {
  it('should construct the full callback URL correctly', () => {
    const req = {
      protocol: 'http',
      get: jest.fn().mockReturnValue('example.com')
    } as unknown as Request;
    const result = buildEndpointURL(req, '/api/callback');

    expect(result).toBe('http://example.com/api/callback');
    expect(req.get).toHaveBeenCalledWith('host');
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
