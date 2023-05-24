import { Pool } from 'pg';
import format from 'pg-format';
import { Logger } from 'winston';
import { Contacts } from '../Contacts';
import { Contact } from '../types';

export default class PgContacts implements Contacts {
  private static readonly REFINE_CONTACTS_SQL =
    'SELECT * FROM refined_persons($1)';

  private static readonly POPULATE_REFINED_SQL =
    'SELECT * FROM populate_refined($1)';

  private static readonly INSERT_MESSAGE_SQL = `
    INSERT INTO messages("channel","folder_path","date","message_id","references","list_id","conversation","userid") 
    VALUES($1, $2, $3, $4, $5, $6, $7, $8) 
    RETURNING id;`;

  private static readonly INSERT_POC_SQL = `
    INSERT INTO pointsofcontact("messageid","name","_from","reply_to","_to","cc","bcc","body","personid","userid")
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id`;

  private static readonly UPSERT_PERSON_SQL = `
    INSERT INTO persons ("name","email","url","image","address","same_as","given_name","family_name","job_title","identifiers","_userid")
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (email) DO UPDATE SET name=excluded.name RETURNING id`;

  private static readonly INSERT_TAGS_SQL = `
    INSERT INTO tags("name","reachable","source","userid","personid")
    VALUES %L
    ON CONFLICT(personid, name) DO NOTHING`;

  constructor(private readonly pool: Pool, private readonly logger: Logger) {}

  async populate(userId: string) {
    try {
      await this.pool.query(PgContacts.POPULATE_REFINED_SQL, [userId]);
      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  async create({ message, persons }: Contact, userId: string) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const { rows } = await client.query(PgContacts.INSERT_MESSAGE_SQL, [
        message.channel,
        message.folderPath,
        message.date,
        message.messageId,
        message.references,
        message.listId,
        message.conversation,
        userId
      ]);

      const messageId = rows[0].id;

      for (const { pointOfContact, person, tags } of persons) {
        // eslint-disable-next-line no-await-in-loop
        const personInsertionResult = await client.query(
          PgContacts.UPSERT_PERSON_SQL,
          [
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
            userId
          ]
        );

        const personId = personInsertionResult.rows[0].id;
        const tagValues = tags.map((tag) => [
          tag.name,
          tag.reachable,
          tag.source,
          userId,
          personId
        ]);

        // eslint-disable-next-line no-await-in-loop
        await client.query(format(PgContacts.INSERT_TAGS_SQL, tagValues));

        // eslint-disable-next-line no-await-in-loop
        await client.query(PgContacts.INSERT_POC_SQL, [
          messageId,
          pointOfContact.name,
          pointOfContact.from,
          pointOfContact.replyTo,
          pointOfContact.to,
          pointOfContact.cc,
          pointOfContact.bcc,
          pointOfContact.body,
          personId,
          userId
        ]);
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      this.logger.error('Error when inserting contact', e);
    } finally {
      client.release();
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
}
