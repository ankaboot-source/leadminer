import { Pool } from 'pg';
import { Logger } from 'winston';
import {
  MiningSource,
  MiningSourceByUser,
  MiningSources,
  ExtendedMiningSourceType,
  ImapMiningSourceCredentials,
  OAuthMiningSourceCredentials,
  PostgreSQLMiningSourceCredentials
} from '../interfaces/MiningSources';

export function isPostgreSQLMiningSourceCredentials(
  credentials: unknown
): credentials is PostgreSQLMiningSourceCredentials {
  if (!credentials || typeof credentials !== 'object') {
    return false;
  }

  const sourceCredentials = credentials as Record<string, unknown>;

  return (
    typeof sourceCredentials.host === 'string' &&
    typeof sourceCredentials.port === 'number' &&
    typeof sourceCredentials.database === 'string' &&
    typeof sourceCredentials.username === 'string' &&
    typeof sourceCredentials.password === 'string' &&
    (sourceCredentials.ssl === undefined ||
      typeof sourceCredentials.ssl === 'boolean')
  );
}

function parseMiningSourceCredentials(
  credentials: unknown
):
  | ImapMiningSourceCredentials
  | OAuthMiningSourceCredentials
  | PostgreSQLMiningSourceCredentials {
  if (typeof credentials === 'string') {
    return JSON.parse(credentials) as
      | ImapMiningSourceCredentials
      | OAuthMiningSourceCredentials
      | PostgreSQLMiningSourceCredentials;
  }

  return credentials as
    | ImapMiningSourceCredentials
    | OAuthMiningSourceCredentials
    | PostgreSQLMiningSourceCredentials;
}

export default class PgMiningSources implements MiningSources {
  private static readonly UPSERT_SQL = `
    INSERT INTO private.mining_sources ("user_id","email","type","credentials")
    VALUES($1,$2,$3,pgp_sym_encrypt($4, $5))
    ON CONFLICT (email, user_id)
    DO UPDATE SET credentials=excluded.credentials,type=excluded.type;`;

  private static readonly GET_BY_USER_SQL = `
    SELECT email, type, pgp_sym_decrypt(credentials, $1) as credentials, passive_mining
    FROM private.mining_sources
    WHERE user_id = $2;`;
  /**
    * 

      private static readonly GET_BY_EMAIL_AND_USERID_SQL = `
          SELECT pgp_sym_decrypt(credentials, $1) as credentials
          FROM private.mining_sources
          WHERE email = $2 and user_id = $3
          LIMIT 1;`;
    */

  constructor(
    private readonly client: Pool,
    private readonly logger: Logger,
    private readonly encryptionKey: string
  ) {}

  getSourcesForUser(userId: string, email?: string): Promise<MiningSource[]> {
    this.logger.warn('Method getSourcesForUser not implemented');
    throw new Error(`Method not implemented, ${userId}, ${email}`);
  }

  async upsert({
    userId,
    credentials,
    email,
    type
  }: MiningSource): Promise<void> {
    try {
      if (
        type === 'postgresql' &&
        !isPostgreSQLMiningSourceCredentials(credentials)
      ) {
        throw new Error('Invalid PostgreSQL source credentials');
      }

      await this.client.query(PgMiningSources.UPSERT_SQL, [
        userId,
        email,
        type,
        JSON.stringify(credentials),
        this.encryptionKey
      ]);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Failed upserting credentials', {
          userId,
          email,
          type,
          error: error.message
        });
      }
      throw error;
    }
  }

  async getByUser(
    userId: string
  ): Promise<(MiningSourceByUser & { passive_mining: boolean })[]> {
    try {
      const { rows } = await this.client.query(
        PgMiningSources.GET_BY_USER_SQL,
        [this.encryptionKey, userId]
      );

      return rows.map((row) => ({
        email: row.email as string,
        type: row.type as ExtendedMiningSourceType,
        credentials: parseMiningSourceCredentials(row.credentials),
        passive_mining: row.passive_mining as boolean
      }));
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Failed retrieving credentials', {
          userId,
          error: error.message
        });
      }
      return [];
    }
  }
  /**

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
  */
}
