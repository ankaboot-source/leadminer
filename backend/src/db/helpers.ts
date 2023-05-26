import { OAuthUsers, OAuthUser } from './OAuthUsers';

/**
 * Finds or creates a user record using the provided email.
 * @param email - The email address of the Google user.
 * @param refreshToken - The refresh token of the Google user.
 * @throws If it fails to create or query the Google user.
 * @returns The Google user record that was found or created.
 */
export default async function findOrCreateOne(
  oAuthUsers: OAuthUsers,
  email: string,
  refreshToken: string
): Promise<OAuthUser | null> {
  /**
   * Temporary implementation: This function serves as a temporary solution until
   * the application starts using the Gotrue user tables. It finds or creates a user
   * based on the provided email and registres all account under the same table as a google user.
   */
  const account = ((await oAuthUsers.getByEmail(email)) ??
    (await oAuthUsers.create({
      email,
      refreshToken
    }))) as OAuthUser;

  if (!account) {
    throw Error('Failed to create or query googleUser');
  }

  if (refreshToken && account.refresh_token !== refreshToken) {
    await oAuthUsers.updateRefreshToken(account.id, refreshToken);
  }

  return account;
}
