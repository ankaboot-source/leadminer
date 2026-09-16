import { checkServerIdentity, type PeerCertificate } from 'tls';

/**
 * Safe wrapper around Node's `tls.checkServerIdentity`.
 *
 * Node can invoke the identity check with a null/undefined certificate when a
 * socket is torn down mid-handshake (observed on the `autoSelectFamily`
 * timeout path while a previous fetch is still cleaning its IMAP pool). The
 * default implementation destructures `cert.subject` and throws a TypeError,
 * turning a transient teardown race into a 500 on the next mining start.
 * IMAP connections already run with `rejectUnauthorized: false`, so skipping
 * the hostname check for malformed/missing certificates is acceptable and
 * matches self-signed IMAP setups.
 */
export function safeCheckServerIdentity(
  host: string,
  cert?: PeerCertificate | null
): Error | undefined {
  if (!cert) return undefined;

  try {
    return checkServerIdentity(host, cert);
  } catch {
    return undefined;
  }
}

/**
 * Errors that are safe to retry once: they surface when an IMAP pool from a
 * just-finished fetch is still tearing down while the next fetch starts.
 */
export function isTransientImapHandshakeError(err: unknown): boolean {
  const message = (err as { message?: string })?.message ?? '';
  const code = (err as { code?: string })?.code;

  return (
    message.includes("Cannot destructure property 'subject'") ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EPIPE'
  );
}
