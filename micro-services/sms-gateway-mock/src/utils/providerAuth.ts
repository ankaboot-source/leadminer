export function parseBasicAuth(
  header: string | null
): { username: string; password: string } | null {
  if (!header || !header.startsWith('Basic ')) {
    return null;
  }
  try {
    const base64 = header.slice(6);
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) {
      return null;
    }
    return {
      username: decoded.slice(0, colonIdx),
      password: decoded.slice(colonIdx + 1)
    };
  } catch {
    return null;
  }
}

export default parseBasicAuth;
