import { jest, describe, expect, it } from '@jest/globals';
import {
  buildEndpointURL,
  buildRedirectUrl,
  encodeJwt,
  decodeJwt
} from '../../src/utils/helpers/oauthHelpers';
import { Request } from 'express';

describe('buildEndpointURL', () => {
  it('should construct the full callback URL correctly', () => {
    const req = {
      protocol: 'http',
      get: jest.fn().mockReturnValue('example.com')
    } as unknown as Request
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

describe('encodeJwt', () => {
  it('should encode the payload object into a JWT', () => {
    const payload = {
      id: 1,
      username: 'john.doe'
    };
    const result = encodeJwt(payload);

    expect(result).toBeTruthy();
  });
});

describe('decodeJwt', () => {
  it('should decode a valid JWT', () => {
    const token = encodeJwt({ name: 'hello' });
    const result = decodeJwt(token);

    expect(result).toBeTruthy();
  });

  it('should throw an error for invalid token', () => {
    const token = 'invalid-token';

    expect(() => {
      decodeJwt(token);
    }).toThrow('Invalid token: payload not found');
  });
});
