import { describe, it, expect } from '@jest/globals';
import type { PeerCertificate } from 'tls';
import {
  safeCheckServerIdentity,
  isTransientImapHandshakeError
} from '../../../src/utils/tls';

describe('safeCheckServerIdentity', () => {
  it('returns undefined instead of throwing when the certificate is missing', () => {
    // Node invokes the identity check with a null cert when a socket is torn
    // down mid-handshake (autoSelectFamily timeout path).
    expect(safeCheckServerIdentity('imap.example.com', null)).toBeUndefined();
    expect(safeCheckServerIdentity('imap.example.com')).toBeUndefined();
  });

  it('never throws for malformed certificates', () => {
    expect(() =>
      safeCheckServerIdentity(
        'imap.example.com',
        {} as unknown as PeerCertificate
      )
    ).not.toThrow();
  });

  it('returns an Error for a well-formed certificate whose subject does not match', () => {
    const cert = {
      subject: { CN: 'other.example.com' },
      subjectaltname: 'DNS:other.example.com',
      issuer: { CN: 'ca' },
      valid_from: 'Jan 1 00:00:00 2020 GMT',
      valid_to: 'Jan 1 00:00:00 2030 GMT',
      fingerprint: 'AA:BB',
      serialNumber: '01',
      raw: Buffer.from('')
    } as unknown as PeerCertificate;

    const result = safeCheckServerIdentity('imap.example.com', cert);
    expect(result).toBeDefined();
    expect(result?.message).toBeTruthy();
  });
});

describe('isTransientImapHandshakeError', () => {
  it('classifies the null-certificate destructuring crash as transient', () => {
    expect(
      isTransientImapHandshakeError(
        new TypeError("Cannot destructure property 'subject' from null")
      )
    ).toBe(true);
  });

  it('classifies reset/timeout/pipe socket errors as transient', () => {
    expect(
      isTransientImapHandshakeError(
        Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })
      )
    ).toBe(true);
    expect(
      isTransientImapHandshakeError(
        Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
      )
    ).toBe(true);
    expect(isTransientImapHandshakeError({ code: 'EPIPE' })).toBe(true);
  });

  it('does not classify authentication failures as transient', () => {
    expect(
      isTransientImapHandshakeError(new Error('Authentication failed'))
    ).toBe(false);
    expect(
      isTransientImapHandshakeError(
        Object.assign(new Error('invalid credentials'), { code: 'EAUTH' })
      )
    ).toBe(false);
  });
});
