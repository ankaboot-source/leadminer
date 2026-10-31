// Constant-time comparison for enrichment webhook tokens.
//
// Webhook callers are unauthenticated at the gateway (`verify_jwt = false`)
// and authenticate solely with the per-task token stored in the task
// details. A naive `===` compare leaks token contents through timing, so
// both values are hashed to a fixed-length SHA-256 digest and compared
// byte-by-byte with a branch-free accumulator.

const encoder = new TextEncoder();

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return new Uint8Array(digest);
}

/**
 * Constant-time string equality. Hashing both inputs first keeps the
 * comparison length-independent and the loop runs over the fixed 32-byte
 * digest regardless of input length.
 */
export async function timingSafeStringEqual(
  a: string,
  b: string,
): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([sha256(a), sha256(b)]);

  let diff = 0;
  for (let i = 0; i < hashA.length; i++) {
    diff |= hashA[i] ^ hashB[i];
  }
  return diff === 0;
}
