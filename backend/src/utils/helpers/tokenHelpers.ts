/**
 * Generates an XOAuth2 token for the user to authenticate with the IMAP server.
 * @param email - The email address of the user.
 * @param accessToken - The current user access token.
 * @returns An string represents a SaslXOAuth2 token.
 */
export default function generateSASLXOAUTH2Token(
  accessToken: string,
  email: string
): string {
  const authData = `user=${email}\x01auth=Bearer ${accessToken}\x01\x01`;
  const xoauth2Token = Buffer.from(authData, 'utf-8').toString('base64');
  return xoauth2Token;
}
