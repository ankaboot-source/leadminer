const { connectionType } = require('../config/supabase.config');
const { PostgresHandler } = require('./node-postgres');
const { SupabaseHandler } = require('./supabase');
const { prepareContacts, logInsertionError } = require('./helpers');

const handler = connectionType === 'pgrest' ? SupabaseHandler : PostgresHandler;

/**
 * Inserts person, pointOfContact, tags to database.
 * @param {string} messageID - Message-id extracted from header
 * @param {object} person - Person object
 * @param {object} pointOfContact - Point of contact object
 * @param {object[]} tags - An array of tags
 */
handler.prototype.storePersonPointOfContactTags = async function (messageID, person, pointOfContact, tags) {

  const { data, error } = await this.upsertPerson(person);

  if (error) {

    logInsertionError('persons', error);

  } else {

    pointOfContact.personid = data.id;
    pointOfContact.messageid = messageID;

    for (const tag of tags) {
      tag.personid = data.id;
    }

    const [pocResult, tagResult] = await Promise.allSettled([this.insertPointOfContact(pointOfContact), this.insertTags(tags)]);

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
  const messageResult = await this.insertMessage(message);

  if (messageResult.error) {
    logInsertionError('messages', messageResult.error);
    return;
  }
  const messageID = messageResult.data.id;
  return Promise.allSettled(
    persons.map(({ person, pointOfContact, tags }) => this.storePersonPointOfContactTags(messageID, person, pointOfContact, tags))
  );

};

const db = new handler();

module.exports = { db };