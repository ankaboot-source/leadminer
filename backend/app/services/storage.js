const { db } = require('../db');
const logger = require('../utils/logger')(module);

/**
 * PrepareData - creates an arrays with data linked through message_id, email. 
 * @param {Object[]} dataArray - An array of objects {message: {}, persons: [{}]}
 * @returns {Object}
 */
function PrepareData(arrayData) {

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
  constructor(batch = false, batchSize = 200, dbClient) {

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

    const { messages, persons, pointOfContacts, tags } = PrepareData(bulkObjects);

    Promise.allSettled([this.db.upsertPerson(persons), this.db.insertMessage(messages)])

      .then(async ([pPromise, mPromise]) => {

        const mids = mPromise.value;
        const pids = pPromise.value;

        if (pids.data && mids.data) {
          pids.data = buildLookup('email', pids.data);
          mids.data = buildLookup('message_id', mids.data);

          for (const tag of tags) {
            if (tag && pids.data[tag.email]) {
              tag.personid = pids.data[tag.email].id;
              delete tag.email;
            }
          }

          for (const poc of pointOfContacts) {
            if (pids.data[poc.email] && mids.data[poc.message_id]) {
              poc.personid = pids.data[poc.email].id;
              poc.messageid = mids.data[poc.message_id].id;
              delete poc.message_id;
              delete poc.email;
            } else {
              // TODO: add logging
            }
          }

          this.db.insertPointOfContact(pointOfContacts).then((res) => {
            if (res.error) {
              console.log(res.error); //TODO: Proper Logging
            }
          });
          this.db.createTags(tags).then((res) => {
            if (res.error) {
              console.log(res.error); //TODO: Proper Logging
            }
          });

        } else {
          //TODO: Proper Logging
          console.log('Top level Message Error', mids.error);
          console.log('Top level Person Error', pids.error);
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
      // TODO: Add proper logging
      console.log(error);
      return;
    }

    const messageID = data[0]?.id;

    for (const dataObject of persons) {

      this.db.upsertPerson([dataObject.person]).then((result) => {

        const { data, error } = result;
        const personID = data[0]?.id;

        if (messageID && personID) {

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

          this.db.insertPointOfContact([dataObject.pointOfContact]).then((res) => {
            if (res.error) {
              console.log('poc ', res.error); //TODO: Proper Logging
            }
          });
          this.db.createTags(dataObject.tags).then((res) => {
            if (res.error) {
              console.log('tag ', res.error); //TODO: Proper Logging
            }
          });

        } else {
          // TODO: add proper logging
          console.log('Error in inserting persons: ', error);
        }
      });
    }
  }

  /**
       * storeData - Stores data, redirects to differnt storing channels based on configuration.
       * @param {*} userID - ID of user
       * @param { Object } object - An object contains extrcted data {message: {}, persons: []}
       */
  async storeData(userID, data) {

    if (!this.batch) {
      await this.store(data);
    } else { // In case we're using bulk
      const releasedData = this.#checkAndReleaseBuffer(userID);
      if (releasedData.length) {
        await this.storeBulk(releasedData);
      } else {
        this.#addToBuffer(userID, data);
      }
    }
  }
}

const storage = new Storage();

module.exports = {
  storage
};