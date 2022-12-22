const { db } = require('../db');
const logger = require('../utils/logger')(module);

const BATCH_SIZE = 200
const USE_BATCH = false

/**
 * prepareData - creates an arrays with data linked through message_id, email. 
 * @param {Object[]} dataArray - An array of objects {message: {}, persons: [{}]}
 * @returns {Object}
 */
function prepareData(arrayData) {

  const object = { messages: [], persons: new Map(), pointOfContacts: [], tags: [] };

  arrayData.forEach(data => {
    object.messages.push(data.message);
    for (const personObject of data.persons) {
      object.persons.set(personObject.person.email, personObject.person);
      object.pointOfContacts.push(personObject.pointOfContact);
      object.tags.push(...personObject.tags);
    }
  });
  object.persons = [...object.persons.values()]; // No duplicates
  return object;

}

function logErrorMessage(tableName, error) {

  logger.error(`Error when inserting to ${tableName} table.`, {
    error: error.message ? error.message : error,
    code: error.code,
  });
}

/**
 * buildLookup - Creates a new object like this {data[key]: data}.
 * @param {string} key - Represents a property inside the object
 * @param {*} objects - Array of objects to be modified
 * @returns {Object}
 */
function buildLookup(key, objects) {
  const result = {};

  for (const data of objects) {
    result[data[key]] = data;
  }
  return result;
}

class Storage {

  #BULK_INSERT_BUFFER = {}; // Private temporary storage for data

  /**
       * Storage constructor - Manages The way we store data
       * @param {string} batch - Inserts in bulk if true else normal insert. Default: True
       * @param {string} batchSize - The Size of the bulk data to be inserted.
       */
  constructor(batch, batchSize, dbClient) {

    this.db = dbClient;
    this.batchSize = batchSize;
    this.batch = batch;
  }

  /**
       * exists - Checks for userID  
       * @param {string} userID - ID of the user.
       */
  #exists(userID) {
    return this.#BULK_INSERT_BUFFER[userID] !== undefined;
  }

  /**
       * _registerUser - Creates new user in buffer.
       * @param {string} userID - ID of the user.
       */
  #registerUser(userID, data) {

    if (!this.#exists(userID)) {
      this.#BULK_INSERT_BUFFER[userID] = [data]; // reserves space for new user
    }
  }

  /**
       * _checkAndReleaseBuffer - Checks if buffer is full
       * @param {string} userID - ID of the user.
       */
  #checkAndReleaseBuffer(userID) {

    const isFull = this.#exists(userID) && this.#BULK_INSERT_BUFFER[userID].length === this.batchSize; // check if max limit is reached
    const data = isFull ? Object.assign([], this.#BULK_INSERT_BUFFER[userID]) : [];
    if (isFull) {
      delete this.#BULK_INSERT_BUFFER[userID];
    }
    return data;
  }

  #addToBuffer(userID, data) {

    if (this.#exists(userID)) {
      this.#BULK_INSERT_BUFFER[userID].push(data);
    } else {
      this.#registerUser(userID, data);
    }

  }
  /**
       * storeBulk - Stores data in batches
       * @param {Object[]} bulkData - Array of objects contains extrcted data [{message: {}, persons: []} ...]
       */
  async storeBulk(bulkObjects) {

    const { messages, persons, pointOfContacts, tags } = prepareData(bulkObjects);

    Promise.allSettled([this.db.upsertPerson(persons), this.db.insertMessage(messages)])

      .then(async ([pPromise, mPromise]) => {

        const mids = mPromise.value;
        const pids = pPromise.value;

        if (!pids.error && !mids.error) {
          pids.data = buildLookup('email', pids.data);
          mids.data = buildLookup('message_id', mids.data);

          for (const tag of tags) {

            tag.personid = pids.data[tag.email].id;
            delete tag.email;
          }

          for (const poc of pointOfContacts) {

            poc.personid = pids.data[poc.email].id;
            poc.messageid = mids.data[poc.message_id].id;
            delete poc.message_id;
            delete poc.email;

          }

          this.db.insertPointOfContact(pointOfContacts).then((data, error) => { if (error) { logErrorMessage('points of contact', res.error) } });
          this.db.createTags(tags).then((data, error) => { if (error) { logErrorMessage('tags', res.error) } });

        } else {
          if (mids.error) logErrorMessage('messages', mids.error);
          if (pids.error) logErrorMessage('persons', pids.error);
        }
      });
  }

  /**
   * _storeData -  Stores data to Message, Person, pointOfContact, tags tables. 
   * @param {*} Object - An object contains extrcted data {message: {}, persons: []}
   */
  async store(object) {

    /**
     * This can be change instead of awaiting for message then acting, we can
     * fire (message call, person call) -> wait -> prepare -> fire (poc, tags)
     */

    const { message, persons } = object;

    const { data, error } = await this.db.insertMessage([message]);

    if (error) {
      logErrorMessage('messages', error)
      return;
    }

    const messageID = data[0]?.id;

    for (const dataObject of persons) {

      const { data, error } = await this.db.upsertPerson([dataObject.person])
      const personID = error ? null : data[0]?.id;

      if (error) {

        logErrorMessage('persons', error)

      } else {

        // Clean data before inserting
        delete dataObject.pointOfContact.email;
        delete dataObject.pointOfContact.message_id;

        // Add relational Id's (Message, Person)
        dataObject.pointOfContact.personid = personID;
        dataObject.pointOfContact.messageid = messageID;

        for (const tag of dataObject.tags) {
          delete tag.email; // Clean
          tag.personid = personID; // Adds personID to tags
        }

        this.db.insertPointOfContact([dataObject.pointOfContact]).then((data, error) => { if (error) { logErrorMessage('points of contact', res.error) } });
        this.db.createTags(dataObject.tags).then((data, error) => { if (error) { logErrorMessage('tags', res.error) } });
      }
    }
  }

  /**
       * storeData - Stores data, redirects to differnt storing channels based on configuration.
       * @param {*} userID - ID of user
       * @param { Object } object - An object contains extrcted data {message: {}, persons: []}
       */
  async storeData(userID, data) {

    switch (this.batch) { // Redirects between channels

      case true:

        const releasedData = this.#checkAndReleaseBuffer(userID);
        if (releasedData.length) await this.storeBulk(releasedData);
        else this.#addToBuffer(userID, data);

      default:
        this.store(data)
    }

  }
}

const storage = new Storage(USE_BATCH, BATCH_SIZE, db);

module.exports = {
  storage
};