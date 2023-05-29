import { Pool } from 'pg';
import { Logger } from 'winston';
import { OAuthUser, OAuthUsers } from '../OAuthUsers';

export default class PgOAuthUsers implements OAuthUsers {
  private static readonly INSERT_SQL = `
    INSERT INTO google_users("email", "refresh_token")
    VALUES($1, $2) RETURNING *`;

  private static readonly GET_BY_EMAIL_SQL = `
    SELECT * FROM google_users
    WHERE email = $1
    LIMIT 1`;

  private static readonly GET_BY_ID_SQL = `
    SELECT * FROM google_users
    WHERE id = $1
    LIMIT 1`;

  private static readonly UPDATE_TOKEN_SQL = `
    UPDATE google_users 
    SET refresh_token = $2 
    WHERE id = $1
    RETURNING *`;

  constructor(private readonly client: Pool, private readonly logger: Logger) {}

  async updateRefreshToken(
    id: string,
    refreshToken: string
  ): Promise<OAuthUser | null> {
    try {
      const { rows } = await this.client.query(PgOAuthUsers.UPDATE_TOKEN_SQL, [
        id,
        refreshToken
      ]);

      if (rows.length > 0) {
        return rows[0] as OAuthUser;
      }

      return null;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async create({
    email,
    refreshToken
  }: {
    email: string;
    refreshToken: string;
  }) {
    try {
      const { rows } = await this.client.query(PgOAuthUsers.INSERT_SQL, [
        email,
        refreshToken
      ]);

      if (rows.length > 0) {
        return rows[0] as OAuthUser;
      }

      return null;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async getByEmail(email: string) {
    try {
      const { rows } = await this.client.query(PgOAuthUsers.GET_BY_EMAIL_SQL, [
        email
      ]);

      if (rows.length > 0) {
        return rows[0] as OAuthUser;
      }

      return null;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async getById(id: string) {
    try {
      const { rows } = await this.client.query(PgOAuthUsers.GET_BY_ID_SQL, [
        id
      ]);

      if (rows.length > 0) {
        return rows[0] as OAuthUser;
      }

      return null;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  /**
   * Finds or creates a user record using the provided email.
   * @param email - The email address of the Google user.
   * @param refreshToken - The refresh token of the Google user.
   * @throws If it fails to create or query the Google user.
   * @returns The Google user record that was found or created.
   */
  async findOrCreateOne(
    email: string,
    refreshToken: string
  ): Promise<OAuthUser | null> {
    /**
     * Temporary implementation: This function serves as a temporary solution until
     * the application starts using the Gotrue user tables. It finds or creates a user
     * based on the provided email and registres all account under the same table as a google user.
     */
    const account = ((await this.getByEmail(email)) ??
      (await this.create({
        email,
        refreshToken
      }))) as OAuthUser;

    if (!account) {
      throw Error('Failed to create or query googleUser');
    }

    if (refreshToken && account.refresh_token !== refreshToken) {
      await this.updateRefreshToken(account.id, refreshToken);
    }

    return account;
  }
}
