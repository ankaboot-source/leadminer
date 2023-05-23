import { Pool } from 'pg';
import { Logger } from 'winston';
import { ImapUser, ImapUsers } from './ImapUsers';

export default class PgImapUsers implements ImapUsers {
  private static readonly GET_BY_EMAIL_QUERY = `
    SELECT * FROM imap_users
    WHERE email = $1
    LIMIT 1`;

  private static readonly GET_BY_ID_QUERY = `
    SELECT * FROM imap_users
    WHERE id = $1
    LIMIT 1`;

  private static readonly INSERT_QUERY = `
    INSERT INTO imap_users(email, host, port, tls)
    VALUES($1, $2, $3, $4)
    RETURNING *`;

  constructor(private readonly client: Pool, private readonly logger: Logger) {}

  async create({
    email,
    host,
    port,
    tls
  }: {
    email: string;
    host: string;
    port: number;
    tls: boolean;
  }) {
    try {
      const { rows } = await this.client.query(PgImapUsers.INSERT_QUERY, [
        email,
        host,
        port,
        tls
      ]);

      if (rows.length > 0) {
        return rows[0] as ImapUser;
      }

      return null;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async getByEmail(email: string) {
    try {
      const { rows } = await this.client.query(PgImapUsers.GET_BY_EMAIL_QUERY, [
        email
      ]);

      if (rows.length > 0) {
        return rows[0] as ImapUser;
      }

      return null;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async getById(id: string) {
    try {
      const { rows } = await this.client.query(PgImapUsers.GET_BY_ID_QUERY, [
        id
      ]);

      if (rows.length > 0) {
        return rows[0] as ImapUser;
      }

      return null;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }
}
