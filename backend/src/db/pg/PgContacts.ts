import { Pool } from 'pg';
import format from 'pg-format';
import { Logger } from 'winston';
import { Status } from '../../services/email-status/EmailStatusVerifier';
import { REACHABILITY } from '../../utils/constants';
import { Contacts } from '../interfaces/Contacts';
import {
  Contact,
  ContactFrontend,
  EmailExtractionResult,
  EmailStatus,
  ExportService,
  ExtractionResult,
  FileExtractionResult,
  GoogleContactsExtractionResult,
  PostgreSQLExtractionResult,
  Tag
} from '../types';

export default class PgContacts implements Contacts {
  private static readonly REFINE_CONTACTS_SQL =
    'SELECT * FROM private.refine_persons($1)';

  private static readonly SELECT_CONTACTS_SQL =
    'SELECT * FROM private.get_contacts_table($1)';

  private static readonly SELECT_EXPORTED_CONTACTS = `
    SELECT contacts.*
    FROM private.get_contacts_table($1) contacts
      JOIN private.engagement e
        ON e.person_id = contacts.id
        AND e.user_id = $1
        AND e.engagement_type = 'EXPORT'
    `;

  private static readonly SELECT_NON_EXPORTED_CONTACTS = `
    SELECT contacts.*
    FROM private.get_contacts_table($1) contacts
      LEFT JOIN private.engagement e
        ON e.person_id = contacts.id
        AND e.user_id = $1
        AND e.engagement_type = 'EXPORT'
    WHERE e.person_id IS NULL;
    `;

  private static readonly SELECT_CONTACTS_BY_IDS =
    'SELECT * FROM private.get_contacts_table_by_ids($1,$2)';

  private static readonly SELECT_CONTACTS_BY_IDS_UNVERIFIED =
    'SELECT * FROM private.get_contacts_table_by_ids($1,$2) WHERE status IS NULL';

  private static readonly SELECT_CONTACTS_UNVERIFIED =
    'SELECT * FROM private.get_contacts_table($1) WHERE status IS NULL';

  private static readonly SELECT_EXPORTED_CONTACTS_BY_IDS = `
    SELECT contacts.*
    FROM private.get_contacts_table_by_ids($1,$2) contacts
      JOIN private.engagement e
        ON e.person_id = contacts.id
        AND e.user_id = $1
        AND e.engagement_type = 'EXPORT'
    `;

  private static readonly SELECT_NON_EXPORTED_CONTACTS_BY_IDS = `
    SELECT contacts.*
    FROM private.get_contacts_table_by_ids($1,$2) contacts
      LEFT JOIN private.engagement e
        ON e.person_id = contacts.id
        AND e.user_id = $1
        AND e.engagement_type = 'EXPORT'
    WHERE e.person_id IS NULL;
    `;

  private static readonly UPDATE_PERSON_STATUS_BULK = `
    UPDATE private.persons
    SET status = update.status
    FROM (VALUES %L) AS update(id, status)
    WHERE persons.id = update.id AND persons.user_id = %L AND persons.status IS NULL`;

  private static readonly INSERT_EXPORTED_CONTACT =
    'INSERT INTO private.engagement (user_id, person_id, engagement_type, service) VALUES %L ON  CONFLICT (person_id, user_id, engagement_type, service) DO NOTHING;';

  private static readonly INSERT_MESSAGE_SQL = `
    INSERT INTO private.messages("channel","folder_path","date","message_id","references","list_id","conversation","user_id") 
    VALUES($1, $2, $3, $4, $5, $6, $7, $8);`;

  private static readonly UPSERT_PERSON_SQL = `
    WITH upserted AS (
      INSERT INTO private.persons ("name","email","url","image","location","same_as","given_name","family_name","job_title","identifiers","user_id", "source", "works_for", "mining_id", "telephone", "alternate_name", "alternate_email")
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (user_id, source, email) WHERE email IS NOT NULL DO UPDATE
      SET
        name = EXCLUDED.name,
        url = EXCLUDED.url,
        image = EXCLUDED.image,
        location = EXCLUDED.location,
        same_as = EXCLUDED.same_as,
        given_name = EXCLUDED.given_name,
        family_name = EXCLUDED.family_name,
        job_title = EXCLUDED.job_title,
        identifiers = EXCLUDED.identifiers,
        works_for = EXCLUDED.works_for,
        mining_id = EXCLUDED.mining_id,
        telephone = EXCLUDED.telephone,
        alternate_name = ARRAY(SELECT DISTINCT UNNEST(COALESCE(private.persons.alternate_name, '{}') || EXCLUDED.alternate_name)),
        alternate_email = ARRAY(SELECT DISTINCT UNNEST(COALESCE(private.persons.alternate_email, '{}') || EXCLUDED.alternate_email))
      WHERE
        private.persons.name IS DISTINCT FROM EXCLUDED.name
        OR private.persons.url IS DISTINCT FROM EXCLUDED.url
        OR private.persons.image IS DISTINCT FROM EXCLUDED.image
        OR private.persons.location IS DISTINCT FROM EXCLUDED.location
        OR private.persons.same_as IS DISTINCT FROM EXCLUDED.same_as
        OR private.persons.given_name IS DISTINCT FROM EXCLUDED.given_name
        OR private.persons.family_name IS DISTINCT FROM EXCLUDED.family_name
        OR private.persons.job_title IS DISTINCT FROM EXCLUDED.job_title
        OR private.persons.identifiers IS DISTINCT FROM EXCLUDED.identifiers
        OR private.persons.works_for IS DISTINCT FROM EXCLUDED.works_for
        OR private.persons.mining_id IS DISTINCT FROM EXCLUDED.mining_id
        OR private.persons.telephone IS DISTINCT FROM EXCLUDED.telephone
        OR private.persons.alternate_name IS DISTINCT FROM EXCLUDED.alternate_name
        OR private.persons.alternate_email IS DISTINCT FROM EXCLUDED.alternate_email
      RETURNING persons.id, persons.email
    )
    SELECT id, email FROM upserted
    UNION ALL
    SELECT id, $2 FROM private.persons
    WHERE email IS NOT NULL
      AND email = $2
      AND user_id = $11
      AND source = $12
    LIMIT 1;`;

  private static readonly UPSERT_PERSONS_BULK_SQL = `
    INSERT INTO private.persons ("name","email","url","image","location","same_as","given_name","family_name","job_title","identifiers","user_id", "source", "works_for", "mining_id", "telephone")
    SELECT *
    FROM UNNEST(
      $1::text[],
      $2::text[],
      $3::text[],
      $4::text[],
      $5::text[],
      $6::text[][],
      $7::text[],
      $8::text[],
      $9::text[],
      $10::text[][],
      $11::uuid[],
      $12::text[],
      $13::uuid[],
      $14::text[],
      $15::text[][]
    )
    ON CONFLICT (user_id, source, email) WHERE email IS NOT NULL DO UPDATE
    SET
      name = EXCLUDED.name,
      url = EXCLUDED.url,
      image = EXCLUDED.image,
      location = EXCLUDED.location,
      same_as = EXCLUDED.same_as,
      given_name = EXCLUDED.given_name,
      family_name = EXCLUDED.family_name,
      job_title = EXCLUDED.job_title,
      identifiers = EXCLUDED.identifiers,
      works_for = EXCLUDED.works_for,
      mining_id = EXCLUDED.mining_id,
      telephone = EXCLUDED.telephone
    WHERE
      private.persons.name IS DISTINCT FROM EXCLUDED.name
      OR private.persons.url IS DISTINCT FROM EXCLUDED.url
      OR private.persons.image IS DISTINCT FROM EXCLUDED.image
      OR private.persons.location IS DISTINCT FROM EXCLUDED.location
      OR private.persons.same_as IS DISTINCT FROM EXCLUDED.same_as
      OR private.persons.given_name IS DISTINCT FROM EXCLUDED.given_name
      OR private.persons.family_name IS DISTINCT FROM EXCLUDED.family_name
      OR private.persons.job_title IS DISTINCT FROM EXCLUDED.job_title
      OR private.persons.identifiers IS DISTINCT FROM EXCLUDED.identifiers
      OR private.persons.works_for IS DISTINCT FROM EXCLUDED.works_for
      OR private.persons.mining_id IS DISTINCT FROM EXCLUDED.mining_id;`;

  private static readonly SELECT_PERSONS_STATUS_BY_IDS = `
    SELECT id, status
    FROM private.persons
    WHERE user_id = $1 AND id = ANY($2);
  `;

  private static readonly INSERT_POC_BULK_SQL = `
    INSERT INTO private.pointsofcontact("message_id","name","from","reply_to","to","cc","bcc","body","person_id","plus_address", "user_id")
    VALUES %L;`;

  private static readonly SELECT_RECENT_EMAIL_STATUS_BY_EMAIL = `
    SELECT *
    FROM private.email_status
    WHERE email = $1
    AND verified_on >= NOW() - INTERVAL '100 days'
    ORDER BY updated_at DESC
    LIMIT 1;
  `;

  private static readonly UPSERT_EMAIL_STATUS_SQL = `
    INSERT INTO private.email_status (email, user_id, status, details, verified_on)
    VALUES ($1, $2, $3, $4,$5)
    ON CONFLICT (email)
    DO UPDATE SET 
        user_id = EXCLUDED.user_id,
        status = EXCLUDED.status,
        details = EXCLUDED.details,
        verified_on = EXCLUDED.verified_on;`;

  private static readonly INSERT_TAGS_SQL = `
    INSERT INTO private.tags("name","reachable","source","user_id","person_id")
    VALUES %L
    ON CONFLICT (person_id, name, user_id) DO NOTHING;`;

  constructor(
    private readonly pool: Pool,
    private readonly logger: Logger
  ) {}

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
        const { rows: personRows } = await this.pool.query(
          'SELECT id FROM private.persons WHERE user_id = $1 AND email = $2 LIMIT 1',
          [userId, email]
        );
        const personId = personRows[0]?.id as string | undefined;
        if (personId) {
          await this.pool.query(
            format(PgContacts.INSERT_TAGS_SQL, [
              [
                'role',
                REACHABILITY.MANY_OR_INDIRECT_PERSON,
                'email-verification',
                userId,
                personId
              ]
            ])
          );
        }
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
    statusUpdates: { status: Status; id: string }[]
  ): Promise<boolean> {
    try {
      const updates = statusUpdates.map((update) => [update.id, update.status]);

      await this.pool.query(
        format(PgContacts.UPDATE_PERSON_STATUS_BULK, updates, userId)
      );

      return true;
    } catch (error) {
      this.logger.error('updateManyPersonsStatus', error);
      return false;
    }
  }

  async getPersonIdByEmail(
    email: string,
    userId: string
  ): Promise<string | null> {
    try {
      const { rows } = await this.pool.query<{ id: string }>(
        'SELECT id FROM private.persons WHERE user_id = $1 AND email = $2 LIMIT 1',
        [userId, email]
      );
      return rows[0]?.id ?? null;
    } catch (error) {
      this.logger.error('getPersonIdByEmail', error);
      return null;
    }
  }

  async create(result: ExtractionResult, userId: string, miningId: string) {
    const results = await (() => {
      if (result.type === 'email') {
        return this.createContactsFromEmail(result, userId, miningId);
      }
      if (result.type === 'google-contacts') {
        return this.createFromGoogleContacts(result, userId, miningId);
      }
      return this.createContactsFromFile(result, userId, miningId);
    })();
    return results;
  }

  private async createContactsFromFile(
    result:
      | FileExtractionResult
      | PostgreSQLExtractionResult
      | GoogleContactsExtractionResult,
    userId: string,
    miningId: string
  ) {
    const organizationsDB = new Map<string, string>();
    const insertedContacts = new Set<{
      id?: string;
      email?: string;
      tags: Tag[];
    }>();

    const { organizations, persons } = result;

    for (const { name } of organizations) {
      const {
        rows: [{ id }]
        // eslint-disable-next-line no-await-in-loop
      } = await this.pool.query(
        'INSERT INTO private.organizations(name) VALUES($1) RETURNING id;',
        [name]
      );
      organizationsDB.set(name, id);
    }

    for (const { person, tags } of persons) {
      // eslint-disable-next-line no-await-in-loop
      const upsertResult = await this.pool.query(PgContacts.UPSERT_PERSON_SQL, [
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
        person.source,
        organizationsDB.get(person.worksFor ?? ''),
        miningId,
        person.telephone,
        null, // $16 alternate_name - not available for file imports
        null // $17 alternate_email - not available for file imports
      ]);
      const personId = upsertResult.rows[0]?.id as string | undefined;

      if (tags.length) {
        // eslint-disable-next-line no-await-in-loop
        await this.pool.query(
          format(
            PgContacts.INSERT_TAGS_SQL,
            tags.map((tag) => [
              tag.name,
              tag.reachable,
              tag.source,
              userId,
              personId ?? null
            ])
          )
        );
      }

      insertedContacts.add({ email: person.email, tags });

      // refinedpersons: skip when there's no email OR no personId
      // (phone-only contacts have no engagement data)
      if (person.email && personId) {
        // eslint-disable-next-line no-await-in-loop
        await this.pool.query(
          `
        INSERT INTO private.refinedpersons(person_id, user_id, tags)
        VALUES ($1, $2, $3)
        ON CONFLICT (person_id, user_id)
        DO UPDATE SET tags = ARRAY(SELECT DISTINCT UNNEST(private.refinedpersons.tags || EXCLUDED.tags));
        `,
          [personId, userId, tags.map((tag) => tag.name)]
        );
      }
    }

    return Array.from(insertedContacts);
  }

  private async createFromGoogleContacts(
    result: GoogleContactsExtractionResult,
    userId: string,
    miningId: string
  ) {
    const organizationsDB = new Map<string, string>();
    const insertedContacts = new Set<{
      id?: string;
      email?: string;
      tags: Tag[];
    }>();

    const { organizations, persons } = result;

    for (const { name } of organizations) {
      const {
        rows: [{ id }]
        // eslint-disable-next-line no-await-in-loop
      } = await this.pool.query(
        'INSERT INTO private.organizations(name) VALUES($1) RETURNING id;',
        [name]
      );
      organizationsDB.set(name, id);
    }

    for (const { person, tags } of persons) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const upsertResult = await this.pool.query(
          PgContacts.UPSERT_PERSON_SQL,
          [
            person.name ?? null, // $1  name
            person.email, // $2  email
            null, // $3  url - Google contacts don't have this
            person.image ?? null, // $4  image
            person.location ?? null, // $5  location
            person.sameAs ?? null, // $6  same_as
            person.givenName ?? null, // $7  given_name
            person.familyName ?? null, // $8  family_name
            person.jobTitle ?? null, // $9  job_title
            null, // $10 identifiers - Google contacts don't have this
            userId, // $11 user_id
            person.source, // $12 source
            organizationsDB.get(person.worksFor ?? ''), // $13 works_for
            miningId, // $14 mining_id
            person.telephone ?? null, // $15 telephone
            person.alternateName ?? null, // $16 alternate_name
            person.alternateEmail ?? null // $17 alternate_email
          ]
        );
        const personId = upsertResult.rows[0]?.id as string | undefined;

        if (tags.length) {
          // eslint-disable-next-line no-await-in-loop
          await this.pool.query(
            format(
              PgContacts.INSERT_TAGS_SQL,
              tags.map((tag) => [
                tag.name,
                tag.reachable,
                tag.source,
                userId,
                personId ?? null
              ])
            )
          );
        }

        insertedContacts.add({ email: person.email, tags });
        if (person.email && personId) {
          // eslint-disable-next-line no-await-in-loop
          await this.pool.query(
            `
          INSERT INTO private.refinedpersons(person_id, user_id, tags)
          VALUES ($1, $2, $3)
          ON CONFLICT (person_id, user_id)
          DO UPDATE SET tags = ARRAY(SELECT DISTINCT UNNEST(private.refinedpersons.tags || EXCLUDED.tags));
          `,
            [personId, userId, tags.map((tag) => tag.name)]
          );
        }
      } catch (error) {
        this.logger.error(
          '[PgContacts.createFromGoogleContacts] Failed to upsert Google contact',
          {
            email: person.email,
            source: person.source,
            worksFor: person.worksFor,
            sameAs: person.sameAs,
            telephone: person.telephone,
            organizationName: organizationsDB.get(person.worksFor ?? ''),
            userId,
            miningId,
            error: (error as Error).message,
            stack: (error as Error).stack
          }
        );
      }
    }

    return Array.from(insertedContacts);
  }

  private async createContactsFromEmail(
    { message, persons }: EmailExtractionResult,
    userId: string,
    miningId: string
  ) {
    try {
      const insertedContacts = new Set<{
        id?: string;
        email?: string;
        tags: Tag[];
      }>();
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

      if (!persons.length) {
        return [];
      }

      const personIds: (string | undefined)[] = [];
      for (const { person } of persons) {
        // eslint-disable-next-line no-await-in-loop
        const result = await this.pool.query(PgContacts.UPSERT_PERSON_SQL, [
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
          person.source,
          person.worksFor,
          miningId,
          person.telephone,
          null, // $16 alternate_name - not available for email contacts
          null // $17 alternate_email - not available for email contacts
        ]);
        personIds.push(result.rows[0]?.id as string | undefined);
      }

      const knownIds = personIds.filter((id): id is string => Boolean(id));
      let statusById = new Map<string, string | null>();
      if (knownIds.length) {
        const { rows } = await this.pool.query(
          PgContacts.SELECT_PERSONS_STATUS_BY_IDS,
          [userId, knownIds]
        );
        statusById = new Map(
          rows.map((row: { id: string; status: string | null }) => [
            row.id,
            row.status
          ])
        );
      }

      const tagValues = persons.flatMap(({ person, tags }, idx) => {
        const personId = personIds[idx];
        if (personId && statusById.has(personId)) {
          const status = statusById.get(personId);
          if (status === null) {
            insertedContacts.add({ email: person.email, tags });
          }
        } else {
          insertedContacts.add({ email: person.email, tags });
        }

        return tags.map((tag) => [
          tag.name,
          tag.reachable,
          tag.source,
          userId,
          personId ?? null
        ]);
      });

      const pocValues = persons.map(({ pointOfContact }, idx) => [
        message.messageId,
        pointOfContact.name,
        pointOfContact.from,
        pointOfContact.replyTo,
        pointOfContact.to,
        pointOfContact.cc,
        pointOfContact.bcc,
        pointOfContact.body,
        personIds[idx],
        pointOfContact.plusAddress,
        userId
      ]);

      const [tagsInsertResult, pocInsertResult] = await Promise.allSettled([
        tagValues.length
          ? this.pool.query(format(PgContacts.INSERT_TAGS_SQL, tagValues))
          : Promise.resolve(),
        pocValues.length
          ? this.pool.query(format(PgContacts.INSERT_POC_BULK_SQL, pocValues))
          : Promise.resolve()
      ]);

      if (tagsInsertResult.status === 'rejected') {
        this.logger.error('[PgContacts.createContactsFromEmail:tags]', {
          error: tagsInsertResult.reason
        });
      }

      if (pocInsertResult.status === 'rejected') {
        this.logger.error(
          '[PgContacts.createContactsFromEmail:pointsOfContact]',
          {
            error: pocInsertResult.reason
          }
        );
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

  async getContacts(userId: string, ids?: string[]): Promise<Contact[]> {
    try {
      const { rows } = ids
        ? await this.pool.query(PgContacts.SELECT_CONTACTS_BY_IDS, [
            userId,
            ids
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
    ids: string[]
  ): Promise<Contact[]> {
    try {
      const { rows } = await this.pool.query(
        ids.length
          ? PgContacts.SELECT_CONTACTS_BY_IDS_UNVERIFIED
          : PgContacts.SELECT_CONTACTS_UNVERIFIED,
        ids.length ? [userId, ids] : [userId]
      );
      return rows;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getExportedContacts(
    userId: string,
    ids?: string[]
  ): Promise<Contact[]> {
    try {
      const { rows } = ids
        ? await this.pool.query(PgContacts.SELECT_EXPORTED_CONTACTS_BY_IDS, [
            userId,
            ids
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
    ids?: string[]
  ): Promise<Contact[]> {
    try {
      const { rows } = ids
        ? await this.pool.query(
            PgContacts.SELECT_NON_EXPORTED_CONTACTS_BY_IDS,
            [userId, ids]
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
    personIds: string[],
    service: ExportService,
    userId: string
  ): Promise<void> {
    try {
      const values = personIds.map((id) => [userId, id, 'EXPORT', service]);
      await this.pool.query(format(PgContacts.INSERT_EXPORTED_CONTACT, values));
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async upsertGoogleContacts(
    contacts: Array<{ person: ContactFrontend; tags: string[] }>,
    userId: string,
    source: string,
    miningId: string
  ): Promise<number> {
    let upserted = 0;

    const UPSERT_SQL = `
      INSERT INTO private.persons
        (name, email, image, location, same_as, given_name, family_name, job_title,
         user_id, source, works_for, mining_id, telephone, alternate_name, alternate_email)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (user_id, source, email) WHERE email IS NOT NULL DO UPDATE
      SET
        name = COALESCE(NULLIF(EXCLUDED.name, ''), private.persons.name),
        image = COALESCE(NULLIF(EXCLUDED.image, ''), private.persons.image),
        location = COALESCE(NULLIF(EXCLUDED.location, ''), private.persons.location),
        same_as = ARRAY(SELECT DISTINCT UNNEST(COALESCE(private.persons.same_as, '{}') || EXCLUDED.same_as)),
        given_name = COALESCE(NULLIF(EXCLUDED.given_name, ''), private.persons.given_name),
        family_name = COALESCE(NULLIF(EXCLUDED.family_name, ''), private.persons.family_name),
        job_title = COALESCE(NULLIF(EXCLUDED.job_title, ''), private.persons.job_title),
        works_for = COALESCE(NULLIF(EXCLUDED.works_for, ''), private.persons.works_for),
        mining_id = EXCLUDED.mining_id,
        telephone = ARRAY(SELECT DISTINCT UNNEST(COALESCE(private.persons.telephone, '{}') || EXCLUDED.telephone)),
        alternate_name = ARRAY(SELECT DISTINCT UNNEST(COALESCE(private.persons.alternate_name, '{}') || EXCLUDED.alternate_name)),
        alternate_email = ARRAY(SELECT DISTINCT UNNEST(COALESCE(private.persons.alternate_email, '{}') || EXCLUDED.alternate_email))
      RETURNING id, email
    `;

    for (const { person } of contacts) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await this.pool.query(UPSERT_SQL, [
          person.name ?? null,
          person.email,
          person.image ?? null,
          person.location ?? null,
          person.same_as ?? null,
          person.given_name ?? null,
          person.family_name ?? null,
          person.job_title ?? null,
          userId,
          source,
          person.works_for ?? null,
          miningId,
          person.telephone ?? null,
          person.alternate_name ?? null,
          person.alternate_email ?? null
        ]);

        if (result.rowCount && result.rowCount > 0) {
          upserted += 1;
        }
      } catch (error) {
        this.logger.error('Failed to upsert Google contact', {
          email: person.email,
          source,
          error
        });
      }
    }

    return upserted;
  }
}
