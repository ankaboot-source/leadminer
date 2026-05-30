import { Pool } from 'pg';
import { Logger } from 'winston';
import {
  SmtpSender,
  SmtpSenderCreate,
  SmtpSenderUpdate,
  SmtpSenders,
  SmtpEncryption,
  SmtpAuthType,
  SmtpOAuthProvider
} from '../interfaces/SmtpSenders';

function toSmtpSender(row: Record<string, unknown>): SmtpSender {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    email: row.email as string,
    smtpHost: row.smtp_host as string,
    smtpPort: row.smtp_port as number,
    smtpEncryption: row.smtp_encryption as SmtpEncryption,
    smtpUser: row.smtp_user as string,
    authType: row.auth_type as SmtpAuthType,
    oauthProvider: row.oauth_provider as SmtpOAuthProvider | undefined,
    active: row.active as boolean,
    miningSourceEmail: row.mining_source_email as string | undefined,
    createdAt:
      typeof row.created_at === 'string'
        ? row.created_at
        : (row.created_at as Date).toISOString(),
    updatedAt:
      typeof row.updated_at === 'string'
        ? row.updated_at
        : (row.updated_at as Date).toISOString()
  };
}

export default class PgSmtpSenders implements SmtpSenders {
  private static readonly SELECT_COLUMNS = `
    id, user_id, name, email, smtp_host, smtp_port, smtp_encryption,
    smtp_user, auth_type, oauth_provider, active, mining_source_email,
    created_at, updated_at`;

  private static readonly GET_BY_USER_SQL = `
    SELECT ${PgSmtpSenders.SELECT_COLUMNS}
    FROM private.smtp_senders
    WHERE user_id = $1
    ORDER BY created_at DESC;`;

  private static readonly GET_BY_ID_SQL = `
    SELECT ${PgSmtpSenders.SELECT_COLUMNS}
    FROM private.smtp_senders
    WHERE id = $1 AND user_id = $2;`;

  private static readonly CREATE_SQL = `
    INSERT INTO private.smtp_senders
      (user_id, name, email, smtp_host, smtp_port, smtp_encryption,
       smtp_user, smtp_password, auth_type, oauth_provider, oauth_refresh_token, mining_source_email)
    VALUES ($1, $2, $3, $4, $5, $6, $7,
       pgp_sym_encrypt($8, $9), $10, $11,
       pgp_sym_encrypt($12, $9), $13)
    RETURNING ${PgSmtpSenders.SELECT_COLUMNS};`;

  private static readonly UPDATE_SQL = `
    UPDATE private.smtp_senders SET
      name = COALESCE($3, name),
      smtp_host = COALESCE($4, smtp_host),
      smtp_port = COALESCE($5, smtp_port),
      smtp_encryption = COALESCE($6, smtp_encryption),
      smtp_user = COALESCE($7, smtp_user),
      smtp_password = COALESCE(pgp_sym_encrypt($8, $9), smtp_password),
      active = COALESCE($10, active),
      updated_at = now()
    WHERE id = $1 AND user_id = $2
    RETURNING ${PgSmtpSenders.SELECT_COLUMNS};`;

  private static readonly DELETE_SQL = `
    DELETE FROM private.smtp_senders WHERE id = $1 AND user_id = $2;`;

  private static readonly DELETE_BY_MINING_SOURCE_SQL = `
    DELETE FROM private.smtp_senders WHERE user_id = $1 AND mining_source_email = $2;`;

  private static readonly GET_PASSWORD_SQL = `
    SELECT pgp_sym_decrypt(smtp_password, $1) as password
    FROM private.smtp_senders
    WHERE id = $2 AND user_id = $3;`;

  constructor(
    private readonly client: Pool,
    private readonly logger: Logger,
    private readonly encryptionKey: string
  ) {}

  async getByUser(userId: string): Promise<SmtpSender[]> {
    try {
      const { rows } = await this.client.query(PgSmtpSenders.GET_BY_USER_SQL, [
        userId
      ]);
      return rows.map(toSmtpSender);
    } catch (error) {
      this.logger.error('Failed fetching SMTP senders', { userId, error });
      throw error;
    }
  }

  async getById(id: string, userId: string): Promise<SmtpSender | null> {
    try {
      const { rows } = await this.client.query(PgSmtpSenders.GET_BY_ID_SQL, [
        id,
        userId
      ]);
      return rows[0] ? toSmtpSender(rows[0]) : null;
    } catch (error) {
      this.logger.error('Failed fetching SMTP sender', { id, userId, error });
      throw error;
    }
  }

  async create(sender: SmtpSenderCreate): Promise<SmtpSender> {
    try {
      const { rows } = await this.client.query(PgSmtpSenders.CREATE_SQL, [
        sender.userId,
        sender.name,
        sender.email,
        sender.smtpHost,
        sender.smtpPort,
        sender.smtpEncryption,
        sender.smtpUser,
        sender.smtpPassword,
        this.encryptionKey,
        sender.authType ?? 'password',
        sender.oauthProvider ?? null,
        sender.oauthRefreshToken ?? null,
        sender.miningSourceEmail ?? null
      ]);
      return toSmtpSender(rows[0]);
    } catch (error) {
      this.logger.error('Failed creating SMTP sender', {
        userId: sender.userId,
        email: sender.email,
        error
      });
      throw error;
    }
  }

  async update(
    id: string,
    userId: string,
    updates: SmtpSenderUpdate
  ): Promise<SmtpSender | null> {
    try {
      const { rows } = await this.client.query(PgSmtpSenders.UPDATE_SQL, [
        id,
        userId,
        updates.name ?? null,
        updates.smtpHost ?? null,
        updates.smtpPort ?? null,
        updates.smtpEncryption ?? null,
        updates.smtpUser ?? null,
        updates.smtpPassword ?? null,
        this.encryptionKey,
        updates.active ?? null
      ]);
      return rows[0] ? toSmtpSender(rows[0]) : null;
    } catch (error) {
      this.logger.error('Failed updating SMTP sender', { id, userId, error });
      throw error;
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    try {
      const result = await this.client.query(PgSmtpSenders.DELETE_SQL, [
        id,
        userId
      ]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      this.logger.error('Failed deleting SMTP sender', { id, userId, error });
      throw error;
    }
  }

  async deleteByMiningSourceEmail(
    userId: string,
    miningSourceEmail: string
  ): Promise<boolean> {
    try {
      const result = await this.client.query(
        PgSmtpSenders.DELETE_BY_MINING_SOURCE_SQL,
        [userId, miningSourceEmail]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      this.logger.error('Failed deleting SMTP sender by mining source', {
        userId,
        miningSourceEmail,
        error
      });
      throw error;
    }
  }

  async getPassword(id: string, userId: string): Promise<string | null> {
    try {
      const { rows } = await this.client.query(PgSmtpSenders.GET_PASSWORD_SQL, [
        this.encryptionKey,
        id,
        userId
      ]);
      return rows[0]?.password ?? null;
    } catch (error) {
      this.logger.error('Failed fetching SMTP password', { id, userId, error });
      throw error;
    }
  }
}
