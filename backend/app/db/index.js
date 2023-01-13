const { connectionType } = require('../config/supabase.config');
const { PostgresHandler } = require('./node-postgres');
const { SupabaseHandler } = require('./supabase');
const { MAPPING_TABLE, prepareContacts, logInsertionError, toCamelCase } = require('./helpers');

const handler = connectionType === 'pgrest' ? SupabaseHandler : PostgresHandler;

/**
 * Inserts person, pointOfContact, tags to database.
 * @param {string} messageID - Message-id extracted from header
 * @param {object} person - Person object
 * @param {object} pointOfContact - Point of contact object
 * @param {object[]} tags - An array of tags
 */
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
    pointOfContact.personid = data.id;
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
handler.prototype.store = async function (contacts, userID) {
  const { message, persons } = prepareContacts(contacts, userID);
  const { data, error } = await this.insertMessage(message);

  if (error !== null) {
    logInsertionError('messages', error);
    return;
  }
  await Promise.allSettled(
    persons.map(({ person, pointOfContact, tags }) =>
      this.storePersonPointOfContactTags(data.id, person, pointOfContact, tags)
    )
  );
};

const db = new handler();

/**
 * fetches and store the column names in a mapping table
 * @async
 */
(async () => {

  const tables = ['messages', 'persons', 'pointsofcontact', 'tags'];
  const query = table => db.client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`);
  const fields = (await Promise.all(tables.map(query))).flatMap(res => res.rows.map(row => row.column_name));

  fields.forEach((field) => MAPPING_TABLE.set(toCamelCase(field), field));
})();

module.exports = { db };
