import { Pool } from 'pg';
import { Logger } from 'winston';
import {
  ImapMiningSourceCredentials,
  MiningSource,
  MiningSources,
  MiningSourceType,
  OAuthMiningSourceCredentials
} from '../interfaces/MiningSources';

export default class PgMiningSources implements MiningSources {
  private static readonly UPSERT_SQL = `
    INSERT INTO private.mining_sources ("user_id","email","type","credentials")
    VALUES($1,$2,$3,pgp_sym_encrypt($4, $5))
    ON CONFLICT (email, user_id)
    DO UPDATE SET credentials=excluded.credentials,type=excluded.type;`;

  private static readonly GET_BY_USER_SQL = `
    SELECT email, type, pgp_sym_decrypt(credentials, $1) as credentials, auto_extract
    FROM private.mining_sources
    WHERE user_id = $2;`;

  private static readonly GET_BY_EMAIL_AND_USERID_SQL = `
    SELECT pgp_sym_decrypt(credentials, $1) as credentials
    FROM private.mining_sources
    WHERE email = $2 and user_id = $3
    LIMIT 1;`;

  constructor(
    private readonly client: Pool,
    private readonly logger: Logger,
    private readonly encryptionKey: string
  ) {}

  async upsert({
    userId,
    credentials,
    email,
    type
  }: MiningSource): Promise<void> {
    try {
      await this.client.query(PgMiningSources.UPSERT_SQL, [
        userId,
        email,
        type,
        JSON.stringify(credentials),
        this.encryptionKey
      ]);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Failed upserting credentials', error);
      }
      throw error;
    }
  }

  async getByUser(userId: string): Promise<
    {
      email: string;
      type: MiningSourceType;
      credentials: ImapMiningSourceCredentials | OAuthMiningSourceCredentials;
      auto_extract: boolean;
    }[]
  > {
    try {
      const { rows } = await this.client.query(
        PgMiningSources.GET_BY_USER_SQL,
        [this.encryptionKey, userId]
      );
      return rows as {
        email: string;
        type: MiningSourceType;
        credentials: ImapMiningSourceCredentials | OAuthMiningSourceCredentials;
        auto_extract: boolean;
      }[];
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Failed retrieving credentials', error);
      }
      return [];
    }
  }

  async getCredentialsBySourceEmail(
    userId: string,
    email: string
  ): Promise<
    (OAuthMiningSourceCredentials | ImapMiningSourceCredentials) | undefined
  > {
    try {
      const { rows } = await this.client.query(
        PgMiningSources.GET_BY_EMAIL_AND_USERID_SQL,
        [this.encryptionKey, email, userId]
      );
      if (rows.length > 0) {
        return JSON.parse(rows[0].credentials) as
          | OAuthMiningSourceCredentials
          | ImapMiningSourceCredentials;
      }
      return undefined;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Failed retrieving credentials', error);
      }
      return undefined;
    }
  }
}
