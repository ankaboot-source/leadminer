const { db } = require('../db');
const logger = require('../utils/logger')(module);
const {useBatch, batchSize } = require('../config/supabase.config');

/**
 * prepareData - Making relation between objects using fields (message_id, email). 
 * @param {Object[]} arrayData - An array of objects {message: {}, persons: [{}]} comes from buffer.
 * @returns {Object}  An object contains a list of messages, persons, pointOfContacts, tags.
 */
function prepareData(arrayData) {

  const object = { messages: [], persons: new Map(), pointOfContacts: [], tags: [] };

  for (const data of arrayData) {

    object.messages.push(data.message);

    for (const personObject of data.persons) {

      object.persons.set(personObject.person.email, personObject.person);
      object.pointOfContacts.push(personObject.pointOfContact);
      object.tags.push(...personObject.tags);

    }

  }
  object.persons = [...object.persons.values()]; // No duplicates
  return object;

}

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
 * buildLookup - IT takes an array of objects and returns a new restructured object.
 * @param {string} key - Represents a property inside the object
 * @param {Object[]} arrayOfObjects - Array of objects to be modified
 * @returns {Object}
 */
function buildLookup(key, arrayOfObjects) {

  const result = {};

  for (const object of arrayOfObjects) {
    result[object[key.toString()]] = object; 
  }

  return result;
}

class Storage {

  #BULK_INSERT_BUFFER = {}; // Private temporary storage for data

  /**
   * @param {string} batch - Inserts in bulk if true else normal insert. Default: True
   * @param {string} batchSize - The Size of the bulk data to be inserted.
   */
  constructor(batch, batchSize, dbClient = db) {

    this.db = dbClient;
    this.batchSize = batchSize;
    this.batch = batch;
  }

  /**
   * #exists - Returns true if user id exists in buffer, else false.  
   * @param {string} userID - ID of the user.
   */
  #exists(userID) {
    return this.#BULK_INSERT_BUFFER[userID.toString()] !== undefined;
  }

  /**
   * #registerUser - Register userID in buffer.
   * @param {string} userID - ID of the user.
   * @param {object} data - An object to be stored
   */
  #registerUser(userID, data) {

    if (!this.#exists(userID)) {
      this.#BULK_INSERT_BUFFER[userID.toString()] = [data]; // reserves space for new user
    }
  }

  /**
   * #checkAndReleaseBuffer - Checks if buffer reached batchSize for a spesific user.
   * if limit is reached, then data in the buffer will be returned and the reserved place will be deleted.
   * @param {string} userID - ID of the user.
   * @returns {Object[]} An array of objects.
   */
  #checkAndReleaseBuffer(userID) {

    const isFull = this.#exists(userID) && this.#BULK_INSERT_BUFFER[userID.toString()].length === this.batchSize; // check if max limit is reached
    const data = isFull ? Object.assign([], this.#BULK_INSERT_BUFFER[userID.toString()]) : [];
    if (isFull) {
      delete this.#BULK_INSERT_BUFFER[userID.toString()];
    }
    return data;
  }

  /**
   * Returns all data in buffer.
   * @param {*} userID 
   * @returns 
   */
  #lastchunckBuffer(userID) {
    
    const data = Object.assign([], this.#BULK_INSERT_BUFFER[userID.toString()]);
    delete this.#BULK_INSERT_BUFFER[userID.toString()];
    return data;
  }

  /**
   * #addToBuffer - stores data in buffer
   * @param {string} userID ID of the user
   * @param {Object} data  The object to be stored.
   */
  #addToBuffer(userID, data) {

    if (this.#exists(userID)) {
      this.#BULK_INSERT_BUFFER[userID.toString()].push(data);
    } else {
      this.#registerUser(userID, data);
    }

  }
  /**
   * storeBulk -  Stores data to Message, Person, pointOfContact, tags tables using bulk insertion.
   * @param {Object[]} bulkData - Array of objects.
   */
  storeBulk(bulkObjects) {

    const { messages, persons, pointOfContacts, tags } = prepareData(bulkObjects);

    Promise.allSettled([this.db.upsertPerson(persons), this.db.insertMessage(messages)])

      .then(([pPromise, mPromise]) => {

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

          this.db.insertPointOfContact(pointOfContacts).then((data, error) => {
            if (error) {
              logInsertionError('points of contact', error); 
            } 
          });
          this.db.createTags(tags).then((data, error) => {
            if (error) {
              logInsertionError('tags', error); 
            } 
          });

        } else {
          if (mids.error) {
            logInsertionError('messages', mids.error); 
          }
          if (pids.error) {
            logInsertionError('persons', pids.error); 
          }
        }
      });
  }

  /**
   * _storeData -  Stores data to Message, Person, pointOfContact, tags tables. 
   * @param {*} Object - An object contains (message, person, pointOfContact, tags) props
   */
  async store(object) {

    /**
     * This can be change instead of awaiting for message then acting, we can
     * fire (message call, person call) -> wait -> prepare -> fire (poc, tags)
     */

    const { message, persons } = object;

    const { data, error } = await this.db.insertMessage([message]);

    if (error) {
      logInsertionError('messages', error);
      return;
    }

    const messageID = data[0]?.id;

    for (const dataObject of persons) {

      const { data, error } = await this.db.upsertPerson([dataObject.person]);
      const personID = error ? null : data[0]?.id;

      if (error) {

        logInsertionError('persons', error);

      } else {

        // Clean data before inserting
        delete dataObject.pointOfContact.email;
        delete dataObject.pointOfContact.message_id;

        // Add relational Id's (Message, Person)
        dataObject.pointOfContact.personid = personID;
        dataObject.pointOfContact.messageid = messageID;

        for (const tag of dataObject.tags) {
          delete tag.email;
          tag.personid = personID; // Adds personID to tags
        }

        this.db.insertPointOfContact([dataObject.pointOfContact]).then((result) => {
          if (result.error) {
            logInsertionError('points of contact', result.error); 
          } 
        });
        this.db.createTags(dataObject.tags).then((result) => {
          if (result.error) {
            logInsertionError('tags', result.error); 
          }
        });
      }
    }
  }

  /**
   * storeData - Stores data, redirects to differnt storing channels based on configuration.
   * @param {*} userID - ID of user
   * @param { Object } object - An object contains extrcted data {message: {}, persons: []}
   */
  async storeData(userID, isLast, data) {

    if (this.batch) { // Redirects between bulk and normal insertion.

      const releasedData = isLast ? this.#lastchunckBuffer(userID) : this.#checkAndReleaseBuffer(userID);
      if (releasedData.length) {
        this.storeBulk(releasedData);
      } else {
        this.#addToBuffer(userID, data); 
      }

    } else {
      await this.store(data); 
    }
  }
}

const storage = new Storage(useBatch, batchSize);

module.exports = {
  storage
};