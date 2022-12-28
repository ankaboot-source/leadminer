const { connectionType } = require('../config/supabase.config');
const { Postgres } = require('./node-postgres');
const { Store } = require('./store');
const { SupabaseHandlers } = require('./supabase');
const logger = require('../utils/logger')(module);


function initDatabase() {

  const db = connectionType == 'pgrest' ? new SupabaseHandlers() : new Postgres(logger)
  const store = new Store(db) 

  return {  
    /**
     * Stores contacts to Message, Person, pointOfContact, tags tables. 
     * @param {{message: object, persons: object[]}} contacts - The extracted (messages, persons, pocs, tags)
     * @param {string} userID - The id of the user
     */
    add: function (contacts, userID) {
      return store.store(contacts, userID)
    },

    /**
     * returns the current db client either 'pgrest' or 'native postgres'
     * @returns {db}
     */
    getClient: function () {
      return db
    }
  }
}

const db = initDatabase()

module.exports = { db };
