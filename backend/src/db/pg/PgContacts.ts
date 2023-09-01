import { Pool } from 'pg';
import format from 'pg-format';
import { Logger } from 'winston';
import { Status } from '../../services/email-status/EmailStatusVerifier';
import { Contacts } from '../interfaces/Contacts';
import { Contact, ExtractionResult } from '../types';

export default class PgContacts implements Contacts {
  private static readonly REFINE_CONTACTS_SQL =
    'SELECT * FROM refine_persons($1)';

  private static readonly SELECT_CONTACTS_SQL =
    'SELECT * FROM get_contacts_table($1)';

  private static readonly SELECT_UNVERIFIED_EMAILS_SQL = `
    SELECT email 
    FROM persons
    WHERE user_id = $1 and status IS NULL
    `;

  private static readonly SELECT_NON_EXPORTED_CONTACTS = `
    SELECT contacts.* 
    FROM get_contacts_table($1) contacts
      LEFT JOIN engagement e
        ON e.person_id = contacts.id
        AND e.user_id = $1
        AND e.engagement_type = 'CSV'
    WHERE e.person_id IS NULL;
    `;

  private static readonly SELECT_EXPORTED_CONTACTS = `
    SELECT contacts.* 
    FROM get_contacts_table($1) contacts
      JOIN engagement e
        ON e.person_id = contacts.id
        AND e.user_id = $1
        AND e.engagement_type = 'CSV'
    `;

  private static readonly UPDATE_PERSON_STATUS_BULK = `
    UPDATE persons 
    SET status = update.status
    FROM (VALUES %L) AS update(email, status) 
    WHERE persons.email = update.email AND persons.user_id = %L AND persons.status IS NULL`;

  private static readonly INSERT_EXPORTED_CONTACT =
    'INSERT INTO engagement (user_id, person_id, engagement_type) VALUES %L;';

  private static readonly INSERT_MESSAGE_SQL = `
    INSERT INTO messages("channel","folder_path","date","message_id","references","list_id","conversation","user_id") 
    VALUES($1, $2, $3, $4, $5, $6, $7, $8);`;

  private static readonly INSERT_POC_SQL = `
    INSERT INTO pointsofcontact("message_id","name","from","reply_to","to","cc","bcc","body","person_email","user_id")
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id;`;

  private static readonly UPSERT_PERSON_SQL = `
    INSERT INTO persons ("name","email","url","image","address","same_as","given_name","family_name","job_title","identifiers","user_id","status")
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (email, user_id) DO UPDATE SET name=excluded.name
    RETURNING persons.email;`;

  private static readonly UPDATE_PERSON_STATUS_SQL = `
    UPDATE persons
    SET status = $1
    WHERE email = $2 AND user_id = $3 AND persons.status IS NULL;`;

  private static readonly INSERT_TAGS_SQL = `
    INSERT INTO tags("name","reachable","source","user_id","person_email")
    VALUES %L
    ON CONFLICT(person_email, name, user_id) DO NOTHING;`;

  constructor(private readonly pool: Pool, private readonly logger: Logger) {}

  async updateSinglePersonStatus(
    personEmail: string,
    userId: string,
    status: Status
  ): Promise<boolean> {
    try {
      await this.pool.query(PgContacts.UPDATE_PERSON_STATUS_SQL, [
        status,
        personEmail,
        userId
      ]);
      return true;
    } catch (error) {
      this.logger.error(error);
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
      this.logger.error(error);
      return false;
    }
  }

  async create({ message, persons }: ExtractionResult, userId: string) {
    try {
      const insertedEmails: string[] = [];

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
        const { rows } = await this.pool.query(PgContacts.UPSERT_PERSON_SQL, [
          person.name,
          person.email,
          person.url,
          person.image,
          person.address,
          person.sameAs,
          person.givenName,
          person.familyName,
          person.jobTitle,
          person.identifiers,
          userId,
          person.status ?? null
        ]);

        if (rows.length) {
          insertedEmails.push(...rows.map((r: { email: string }) => r.email));
        }

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

      return insertedEmails;
    } catch (e) {
      this.logger.error('Error when inserting contact', e);
      return [];
    }
  }

  async refine(userId: string): Promise<boolean> {
    try {
      await this.pool.query(PgContacts.REFINE_CONTACTS_SQL, [userId]);
      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  async getContacts(userId: string): Promise<Contact[]> {
    try {
      const { rows } = await this.pool.query(PgContacts.SELECT_CONTACTS_SQL, [
        userId
      ]);

      return rows;
    } catch (error) {
      this.logger.error(error);
      return [];
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

  async getNonExportedContacts(userId: string): Promise<Contact[]> {
    try {
      const { rows } = await this.pool.query(
        PgContacts.SELECT_NON_EXPORTED_CONTACTS,
        [userId]
      );

      return rows;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getExportedContacts(userId: string): Promise<Contact[]> {
    try {
      const { rows } = await this.pool.query(
        PgContacts.SELECT_EXPORTED_CONTACTS,
        [userId]
      );
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
