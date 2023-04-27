import { CONNECTION_TYPE } from '../config';
import {
  MAPPING_TABLE,
  logInsertionError,
  prepareContacts,
  toCamelCase
} from './helpers';
import PostgresHandler from './node-postgres';
import SupabaseHandler from './supabase';

const handler =
  CONNECTION_TYPE === 'pgrest' ? SupabaseHandler : PostgresHandler;

/**
 * Inserts person, pointOfContact, tags to database.
 * @param {string} messageID - Message-id extracted from header
 * @param {object} person - Person object
 * @param {object} pointOfContact - Point of contact object
 * @param {object[]} tags - An array of tags
 */
// eslint-disable-next-line func-names
handler.prototype.storePersonPointOfContactTags = async function (
  messageID,
  person,
  pointOfContact,
  tags
) {
  const { data, error } = await this.upsertPerson(person);

  if (error) {
    logInsertionError('persons', error);
  } else {
    // eslint-disable-next-line no-param-reassign
    pointOfContact.personid = data.id;
    // eslint-disable-next-line no-param-reassign
    pointOfContact.messageid = messageID;

    for (const tag of tags) {
      tag.personid = data.id;
    }

    const [pocResult, tagResult] = await Promise.allSettled([
      this.insertPointOfContact(pointOfContact),
      this.insertTags(tags)
    ]);

    if (pocResult.value.error) {
      logInsertionError('points of contact', pocResult.value.error);
    }

    if (tagResult.value.error) {
      logInsertionError('tags', tagResult.value.error);
    }
  }
};

/**
 * Stores contacts to Message, Person, pointOfContact, tags tables.
 * @param {{message: object, persons: object[]}} contacts - The extracted (messages, persons, pocs, tags)
 * @param {string} userID - The id of the user
 */
// eslint-disable-next-line func-names
handler.prototype.store = async function (contacts, userID) {
  const { message, persons } = prepareContacts(contacts, userID);
  const { data, error } = await this.insertMessage(message);

  if (error !== null) {
    logInsertionError('messages', error, { messageId: message.message_id });
    return;
  }
  await Promise.allSettled(
    persons.map(({ person, pointOfContact, tags }) =>
      this.storePersonPointOfContactTags(data.id, person, pointOfContact, tags)
    )
  );
};

// eslint-disable-next-line new-cap
const db = new handler();

/**
 * fetches and store the column names in a mapping table
 * @async
 */
(async () => {
  const tables = ['messages', 'persons', 'pointsofcontact', 'tags'];
  const query = (table) =>
    db.client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`
    );
  const fields = (await Promise.all(tables.map(query))).flatMap((res) =>
    res.rows.map((row) => row.column_name)
  );

  fields.forEach((field) => MAPPING_TABLE.set(toCamelCase(field), field));
})();

export default db;
