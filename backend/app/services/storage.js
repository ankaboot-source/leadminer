const { db } = require('../db');
const logger = require('../utils/logger')(module);

/**
 * PrepareData - creates an arrays with data linked through message_id, email. 
 * @param {Object[]} dataArray - An array of objects {message: {}, persons: [{}]}
 * @returns {Object}
 */
function PrepareData(arrayData) {

    const object = { messages: [], persons: new Map(), pointOfContacts: [], tags: [] }

    arrayData.forEach(data => {
        object.messages.push(data.message)
        for (const personObject of data.persons) {
            object.persons.set(personObject.person.email, personObject.person)
            object.pointOfContacts.push(personObject.pointOfContact)
            object.tags.push(...personObject.tags)
        }
    });
    object.persons = [...object.persons.values()] // No duplicates
    return object

}

/**
 * buildLookup - Creates a new object like this {data[key]: data}.
 * @param {string} key - Represents a property inside the object
 * @param {*} objects - Array of objects to be modified
 * @returns {Object}
 */
function buildLookup(key, objects) {
    const result = {}

    for (const data of objects) {
        result[data[key]] = data
    }
    return result
}

class Storage {

    #BULK_INSERT_BUFFER = {}   // Private temporary storage for data

    /**
     * Stores data
     * @param {string} url - The supabase URL.
     * @param {string} token - The supabase token.
     */
    constructor(batch=true, batchSize = 200, databaseClient = db) {

        this.db = databaseClient
        this.batchSize = batchSize
        this.batch = batch
    }

    /**
     * exists - Checks for userID  
     * @param {string} userID - ID of the user.
     */
    #exists(userID) {
        return this.#BULK_INSERT_BUFFER[userID] !== undefined
    }

    /**
     * _registerUser - Creates new user in buffer.
     * @param {string} userID - ID of the user.
     */
    #registerUser(userID, data) {

        if (!this.#exists(userID)) {
            this.#BULK_INSERT_BUFFER[userID] = [data] // reserves space for new user
        }
    }

    /**
     * _checkAndReleaseBuffer - Checks if buffer is full
     * @param {string} userID - ID of the user.
     */
    #checkAndReleaseBuffer(userID) {

        const isFull = this.#exists(userID) && this.#BULK_INSERT_BUFFER[userID].length === this.batchSize // check if max limit is reached
        const data = isFull ? Object.assign([], this.#BULK_INSERT_BUFFER[userID]) : []
        isFull ? delete this.#BULK_INSERT_BUFFER[userID] : undefined
        return data
    }

    #addToBuffer(userID, data) {
        
        if (this.#exists(userID)) this.#BULK_INSERT_BUFFER[userID].push(data)
        else this.#registerUser(userID, data)

    }
    /**
     * storeBulk - Stores data in batches
     * @param {Object[]} bulkData - Array of objects
     * @returns {Promise}
     */
    async storeBulk(bulkObjects) {

        const { messages, persons, pointOfContacts, tags } = PrepareData(bulkObjects)
        if (!messages.length && !persons.length) {
            console.log(messages, persons)
        } else {
            Promise.allSettled([this.db.upsertPerson(persons), this.db.insertMessage(messages)])

            .then(async ([pPromise, mPromise]) => {

                const mids = mPromise.value
                const pids = pPromise.value

                if (pids.data && mids.data) {
                    pids.data = buildLookup('email', pids.data)
                    mids.data = buildLookup('message_id', mids.data)

                    for (const tag of tags) {
                        if (tag && pids.data[tag.email])
                            tag.personid = pids.data[tag.email].id; delete tag.email
                    }

                    for (const poc of pointOfContacts) {
                        if (pids.data[poc.email] && mids.data[poc.message_id]) {
                            poc.personid = pids.data[poc.email].id
                            poc.messageid = mids.data[poc.message_id].id
                            delete poc.message_id
                            delete poc.email
                        } else {
                            // TODO: add logging
                        }
                    }

                    this.db.insertPointOfContact(pointOfContacts).then((res) => {if (res.error) console.log(err)})
                    this.db.createTags(tags).then((res) => { { if (res.error) console.log(error) } })

                } else {
                    // TODO: add logging
                    console.log("Top level Message Error", mids.error)
                    console.log("Top level Person Error", pids.error)
                }
            })
        }
    }

    /**
     * _storeData -  Stores data to Message, Person, pointOfContact, tags tables. 
     * @param {*} Object 
     */
    async store(object) {
        // TODO: rebuild this !!!

        // const { data, error } = await this.db.insertMessage(message_id, userid, channel, folderPath, date)
        // const messageID = data?.id

        // if (error) {
        //     console.log(error)
        // }
        // for (const data of dataObject.persons) {
        //     const { _userid, email, name } = data.person
        //     const { field_name } = data.pointOfContact

        //     this.db.insertPersons(name, email, _userid).then((person, error) => {

        //         if (messageID && person.data.id) {
        //             this.db.insertPointOfContact(messageID, _userid, person.data.id, field_name, name)
        //             for (const tag of data.tags)
        //                 tag.personid = person.data.id

        //             this.db.createTags(data.tags)
        //         } else {
        //             console.log(error)
        //         }

        //     })
        // }
    }

    /**
     * storeData - Stores data, redirects to differnt storing channels based on configuration.
     * @param {*} userID - ID of user
     * @param { Object } object - A data object
     */
    async storeData(userID, data) {

        if (!this.batch) {
            this.store(data)
        }
        else{   // In case we're using bulk
            const releasedData = this.#checkAndReleaseBuffer(userID)
            if (releasedData.length) {
                await this.storeBulk(releasedData)
            } else {
                this.#addToBuffer(userID, data);
            }
        }
    }
}

const storage = new Storage()

module.exports = {
    storage,
}