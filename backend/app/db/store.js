const logger = require('../utils/logger')(module);

/**
 * logInsertionError - Formatting and logging insertion errors to stdout.
 * @param {*} tableName -  Name of db table.
 * @param {*} err  - Error object that comes from the query.
 */
function logInsertionError(tableName, err) {

  logger.error(`Error when inserting to ${tableName} table.`, {
    error: err.message ? err.message : err.detail ? err.detail : err,
    code: err.code
  });
}

/**
 * Converts object keys from camelCase to snake_case for db fields.
 * @param {object} CamelCaseObject - Object with possible camleCase fields
 * @returns {object} new object with keys converted to snake_case.
 * Example:
 *  - {userId: 1} = {user_id: 1}
 */
function normalizeFields(CamelCaseObject) {
  return Object.assign({}, ...Object.keys(CamelCaseObject).map(key => {
    return { [key.replace(/(?<c>[A-Z])/g, '_$1').toLowerCase()]: CamelCaseObject[key.toString()] };
  }));
}

/**
 * Adds the userid to message, person, poc, tags and converts keys to DB format. 
 * @param {{message: object, persons: object[]}} contacts - Object contains the extracted data message, person, poc, tags
 * @param {string} userID - The id of the user
 * @returns {object}
 */
function prepareContacts(contacts, userID) {

  const { message, persons } = contacts;

  // add userID to message, person, pocs and tags
  message.userid = userID;

  for (const {person, pointOfContact, tags} of persons) {

    person.userid = userID;
    pointOfContact.userid = userID;

    person = normalizeFields(person);
    pointOfContact = normalizeFields(pointOfContact);

    for (let tag of tags) {
      tag.userid = userID;
      tag = normalizeFields(tag);
    }
  }
  return { message: normalizeFields(message), persons };
}


class Store {
  constructor(dbClient) {
    this.db = dbClient;
  }
}

Store.prototype = {
  
  /**
   * Inserts person, pointOfContact, tags to database.
   * @param {string} messageID - Message-id extracted from header
   * @param {object} person - Person object
   * @param {object} pointOfContact - Point of contact object
   * @param {object[]} tags - An array of tags
   */
  storePersonPointOfContactTags: async function (messageID, person, pointOfContact, tags) {

    const { data, error } = await db.upsertPerson(person);

    if (error) {

      logInsertionError('persons', error);

    } else {

      pointOfContact.personid = data[0].id;
      pointOfContact.messageid = messageID;

      for (const tag of tags) {
        tag.personid = data[0].id;
      }

      const [pocResult, tagResult] = await Promise.allSettled([db.insertPointOfContact(pointOfContact), db.createTags(tags)]);

      if (pocResult.value.error) {
        logInsertionError('points of contact', pocResult.value.error);
      }

      if (tagResult.value.error) {
        logInsertionError('tags', tagResult.value.error);
      }
    }
  },
  
  /**
   * store -  Stores data to Message, Person, pointOfContact, tags tables. 
   * @param {{message: object, persons: object[]}} contacts - The extracted message, person, poc, tags
   * @param {string} userID - The id of the user
   */
  store: async function(contacts, userID) {
    
    const { message, persons } = prepareContacts(contacts, userID);
    const messageResult = await this.db.insertMessage(message);

    if (messageResult.error) {
      logInsertionError('messages', messageResult.error);
      return;
    }
    const messageID = messageResult.data[0]?.id;
    return Promise.allSettled(
      persons.map(({ person, pointOfContact, tags }) => this.#storePersonPointOfContactTags(messageID, person, pointOfContact, tags))
    );
  }
}

module.exports = {
  Store
};