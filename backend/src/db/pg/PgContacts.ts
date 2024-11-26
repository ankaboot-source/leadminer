import { Pool } from 'pg';
import format from 'pg-format';
import { Logger } from 'winston';
import { Status } from '../../services/email-status/EmailStatusVerifier';
import { REACHABILITY } from '../../utils/constants';
import { Contacts } from '../interfaces/Contacts';
import { Contact, EmailStatus, ExtractionResult, Tag } from '../types';

export default class PgContacts implements Contacts {
  private static readonly REFINE_CONTACTS_SQL =
    'SELECT * FROM refine_persons($1)';

  private static readonly SELECT_UNVERIFIED_EMAILS_SQL = `
    SELECT
      p.email
    FROM
      persons p
      JOIN refined_persons rp on rp.email = p.email
      JOIN email_status es on p.email = es.email
    WHERE
      p.user_id = $1
      and es.status IS NULL
    `;

  private static readonly SELECT_CONTACTS_SQL =
    'SELECT * FROM get_contacts_table($1)';

  private static readonly SELECT_EXPORTED_CONTACTS = `
    SELECT contacts.* 
    FROM get_contacts_table($1) contacts
      JOIN engagement e
        ON e.email = contacts.email
        AND e.user_id = $1
        AND e.engagement_type = 'CSV'
    `;

  private static readonly SELECT_NON_EXPORTED_CONTACTS = `
    SELECT contacts.* 
    FROM get_contacts_table($1) contacts
      LEFT JOIN engagement e
        ON e.email = contacts.email
        AND e.user_id = $1
        AND e.engagement_type = 'CSV'
    WHERE e.email IS NULL;
    `;

  private static readonly SELECT_CONTACTS_BY_EMAILS =
    'SELECT * FROM get_contacts_table_by_emails($1,$2)';

  private static readonly SELECT_CONTACTS_BY_EMAILS_UNVERIFIED =
    'SELECT * FROM get_contacts_table_by_emails($1,$2) WHERE status IS NULL';

  private static readonly SELECT_EXPORTED_CONTACTS_BY_EMAILS = `
    SELECT contacts.* 
    FROM get_contacts_table_by_emails($1,$2) contacts
      JOIN engagement e
        ON e.email = contacts.email
        AND e.user_id = $1
        AND e.engagement_type = 'CSV'
    `;

  private static readonly SELECT_NON_EXPORTED_CONTACTS_BY_EMAILS = `
    SELECT contacts.* 
    FROM get_contacts_table_by_emails($1,$2) contacts
      LEFT JOIN engagement e
        ON e.email = contacts.email
        AND e.user_id = $1
        AND e.engagement_type = 'CSV'
    WHERE e.email IS NULL;
    `;

  private static readonly UPDATE_PERSON_STATUS_BULK = `
    UPDATE persons 
    SET status = update.status
    FROM (VALUES %L) AS update(email, status) 
    WHERE persons.email = update.email AND persons.user_id = %L AND persons.status IS NULL`;

  private static readonly INSERT_EXPORTED_CONTACT =
    'INSERT INTO engagement (user_id, email, engagement_type) VALUES %L ON  CONFLICT (email, user_id, engagement_type) DO NOTHING;';

  private static readonly INSERT_MESSAGE_SQL = `
    INSERT INTO messages("channel","folder_path","date","message_id","references","list_id","conversation","user_id") 
    VALUES($1, $2, $3, $4, $5, $6, $7, $8);`;

  private static readonly INSERT_POC_SQL = `
    INSERT INTO pointsofcontact("message_id","name","from","reply_to","to","cc","bcc","body","person_email","user_id")
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id;`;

  private static readonly UPSERT_PERSON_SQL = `
    INSERT INTO persons ("name","email","url","image","location","same_as","given_name","family_name","job_title","identifiers","user_id", "source")
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (email, user_id, source) DO UPDATE SET name=excluded.name
    RETURNING persons.email;`;

  private static readonly SELECT_RECENT_EMAIL_STATUS_BY_EMAIL = `
    SELECT *
    FROM public.email_status
    WHERE email = $1
    AND verified_on >= NOW() - INTERVAL '100 days'
    ORDER BY updated_at DESC
    LIMIT 1;
  `;

  private static readonly UPSERT_EMAIL_STATUS_SQL = `
    INSERT INTO email_status (email, user_id, status, details, verified_on)
    VALUES ($1, $2, $3, $4,$5)
    ON CONFLICT (email, user_id)
    DO UPDATE SET 
        status = EXCLUDED.status,
        details = EXCLUDED.details,
        verified_on = EXCLUDED.verified_on;`;

  private static readonly INSERT_TAGS_SQL = `
    INSERT INTO tags("name","reachable","source","user_id","person_email")
    VALUES %L
    ON CONFLICT(person_email, name, user_id) DO NOTHING;`;

  constructor(private readonly pool: Pool, private readonly logger: Logger) {}

  async SelectRecentEmailStatus(email: string): Promise<EmailStatus | null> {
    try {
      const result = await this.pool.query(
        PgContacts.SELECT_RECENT_EMAIL_STATUS_BY_EMAIL,
        [email]
      );

      if (result.rows.length > 0) {
        const [row] = result.rows;
        return {
          email: row.email,
          userId: row.user_id,
          status: row.status,
          details: row.details,
          verifiedOn: row.verified_on
        } as EmailStatus;
      }

      return null;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}:getPersonStatus]`, error);
      return null; // Return null in case of an error
    }
  }

  async upsertEmailStatus({
    email,
    userId,
    status,
    details,
    verifiedOn
  }: EmailStatus): Promise<boolean> {
    try {
      const query = await this.pool.query(PgContacts.UPSERT_EMAIL_STATUS_SQL, [
        email,
        userId,
        status,
        details,
        verifiedOn
      ]);

      if (query.rowCount === 0) {
        throw new Error(
          `[${this.constructor.name}:upsertEmailStatus]: 0 rows are updated for email status.`
        );
      }

      if (details?.isRole) {
        await this.pool.query(
          format(PgContacts.INSERT_TAGS_SQL, [
            [
              'role',
              REACHABILITY.MANY_OR_INDIRECT_PERSON,
              'email-verification',
              userId,
              email
            ]
          ])
        );
      }
      return true;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}:upsertEmailStatus]`, {
        email,
        status,
        error: (error as Error).message
      });
      return false;
    }
  }

  async updateManyPersonsStatus(
    userId: string,
    emailsToUpdate: { status: Status; email: string }[]
  ): Promise<boolean> {
    try {
      const updates = emailsToUpdate.map((update) => [
        update.email,
        update.status
      ]);

      await this.pool.query(
        format(PgContacts.UPDATE_PERSON_STATUS_BULK, updates, userId)
      );

      return true;
    } catch (error) {
      this.logger.error('updateManyPersonsStatus', error);
      return false;
    }
  }

  async create({ message, persons }: ExtractionResult, userId: string) {
    try {
      const insertedContacts = new Set<{ email: string; tags: Tag[] }>();
      await this.pool.query(PgContacts.INSERT_MESSAGE_SQL, [
        message.channel,
        message.folderPath,
        message.date,
        message.messageId,
        message.references,
        message.listId,
        message.conversation,
        userId
      ]);

      for (const { pointOfContact, person, tags } of persons) {
        // eslint-disable-next-line no-await-in-loop
        const { rowCount: selectResults } = await this.pool.query(
          'SELECT email FROM persons WHERE user_id = $1 AND email = $2;',
          [userId, person.email]
        );
        if (selectResults === 0) {
          insertedContacts.add({ email: person.email, tags });
        }

        // eslint-disable-next-line no-await-in-loop
        await this.pool.query(PgContacts.UPSERT_PERSON_SQL, [
          person.name,
          person.email,
          person.url,
          person.image,
          person.location,
          person.sameAs,
          person.givenName,
          person.familyName,
          person.jobTitle,
          person.identifiers,
          userId,
          person.source
        ]);

        const tagValues = tags.map((tag) => [
          tag.name,
          tag.reachable,
          tag.source,
          userId,
          person.email
        ]);

        // eslint-disable-next-line no-await-in-loop
        await Promise.allSettled([
          this.pool.query(format(PgContacts.INSERT_TAGS_SQL, tagValues)),
          this.pool.query(PgContacts.INSERT_POC_SQL, [
            message.messageId,
            pointOfContact.name,
            pointOfContact.from,
            pointOfContact.replyTo,
            pointOfContact.to,
            pointOfContact.cc,
            pointOfContact.bcc,
            pointOfContact.body,
            person.email,
            userId
          ])
        ]);
      }

      return Array.from(insertedContacts);
    } catch (e) {
      this.logger.error('Error when inserting contact', e);
      throw e;
    }
  }

  async refine(userId: string): Promise<boolean> {
    try {
      await this.pool.query(PgContacts.REFINE_CONTACTS_SQL, [userId]);
      return true;
    } catch (error) {
      this.logger.error('[PgContacts.refine]', error);
      return false;
    }
  }

  async getUnverifiedEmails(userId: string): Promise<string[]> {
    try {
      const { rows } = await this.pool.query(
        PgContacts.SELECT_UNVERIFIED_EMAILS_SQL,
        [userId]
      );

      return rows.map((r) => r.email);
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getContacts(userId: string, emails?: string[]): Promise<Contact[]> {
    try {
      const { rows } = emails
        ? await this.pool.query(PgContacts.SELECT_CONTACTS_BY_EMAILS, [
            userId,
            emails
          ])
        : await this.pool.query(PgContacts.SELECT_CONTACTS_SQL, [userId]);
      return rows;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getUnverifiedContacts(
    userId: string,
    emails: string[]
  ): Promise<Contact[]> {
    try {
      const { rows } = await this.pool.query(
        PgContacts.SELECT_CONTACTS_BY_EMAILS_UNVERIFIED,
        [userId, emails]
      );
      return rows;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getExportedContacts(
    userId: string,
    emails?: string[]
  ): Promise<Contact[]> {
    try {
      const { rows } = emails
        ? await this.pool.query(PgContacts.SELECT_EXPORTED_CONTACTS_BY_EMAILS, [
            userId,
            emails
          ])
        : await this.pool.query(PgContacts.SELECT_EXPORTED_CONTACTS, [userId]);
      return rows;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getNonExportedContacts(
    userId: string,
    emails?: string[]
  ): Promise<Contact[]> {
    try {
      const { rows } = emails
        ? await this.pool.query(
            PgContacts.SELECT_NON_EXPORTED_CONTACTS_BY_EMAILS,
            [userId, emails]
          )
        : await this.pool.query(PgContacts.SELECT_NON_EXPORTED_CONTACTS, [
            userId
          ]);

      return rows;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async registerExportedContacts(
    contactIds: string[],
    userId: string
  ): Promise<void> {
    try {
      const values = contactIds.map((id) => [userId, id, 'CSV']);
      await this.pool.query(format(PgContacts.INSERT_EXPORTED_CONTACT, values));
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }
}
