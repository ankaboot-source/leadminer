const { db } = require('../db');
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

class Storage {

  constructor(dbClient = db) {
    this.db = dbClient;
  }

  /**
   * Converts object keys from camelCase to snake_case for db fields.
   * @param {object} obj
   * @returns {object} new object with keys converted to snake_case.
   * Example:
   *  - {userId: 1} = {user_id: 1}
   */
  #construcObjectDB(obj) {
    return Object.assign({}, ...Object.keys(obj).map(key => {
      return { [key.replace(/([A-Z])/g, '_$1').toLowerCase()]: obj[key.toString()] };
    }));
  }

  /**
   * Adds the userid to message, person, poc, tags and converts keys to DB format. 
   * @param {{message: object, persons: object[]}} extractedData - Object contains the extracted data message, person, poc, tags
   * @param {string} userID - The id of the user
   * @returns {object}
   */
  #prepareData(extractedData, userID) {

    const { message, persons } = extractedData;

    // add userID to message, person, pocs and tags
    message.userid = userID;

    for (const personObj of persons) {

      personObj.person.userid = userID;
      personObj.pointOfContact.userid = userID;

      personObj.person = this.#construcObjectDB(personObj.person);
      personObj.pointOfContact = this.#construcObjectDB(personObj.pointOfContact);

      for (let tag of personObj.tags) {
        tag.userid = userID;
        tag = this.#construcObjectDB(tag);
      }
    }
    return { message: this.#construcObjectDB(message), persons };
  }

  /**
   * Inserts person, pointOfContact, tags to database.
   * @param {string} messageID - Message-id extracted from header
   * @param {object} person - Person object
   * @param {object} pointOfContact - Point of contact object
   * @param {object[]} tags - An array of tags
   */
  async storePersonPointOfContactTags(messageID, person, pointOfContact, tags) {

    const { data, error } = await this.db.upsertPerson(person);

    if (error) {

      logInsertionError('persons', error);

    } else {

      pointOfContact.personid = data[0].id;
      pointOfContact.messageid = messageID;

      for (const tag of tags) {
        tag.personid = data[0].id;
      }

      const [pocResult, tagResult] = await Promise.allSettled([this.db.insertPointOfContact(pointOfContact), this.db.createTags(tags)]);

      if (pocResult.value.error) {
        logInsertionError('points of contact', pocResult.value.error);
      }

      if (tagResult.value.error) {
        logInsertionError('tags', tagResult.value.error);
      }
    }
  }

  /**
   * store -  Stores data to Message, Person, pointOfContact, tags tables. 
   * @param {{message: object, persons: object[]}} extractedData - The extracted message, person, poc, tags
   * @param {string} userID - The id of the user
   */
  async store(extractedData, userID) {

    /**
     * This can be change instead of awaiting for message then acting, we can
     * fire (message call, person call) -> wait -> prepare -> fire (poc, tags)
     */

    const { message, persons } = this.#prepareData(extractedData, userID);

    const messageResult = await this.db.insertMessage(message);

    if (messageResult.error) {
      logInsertionError('messages', messageResult.error);
      return;
    }

    const messageID = messageResult.data[0]?.id;

    Promise.allSettled(
      persons.map(({ person, pointOfContact, tags }) => this.storePersonPointOfContactTags(messageID, person, pointOfContact, tags))
    );
  }
}

const storage = new Storage();

module.exports = {
  storage
};