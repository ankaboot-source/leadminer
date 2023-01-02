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
 * @param {object} camelCaseObject - Object with possible camleCase fields
 * @returns {object} new object with keys converted to snake_case.
 * Example:
 *  - {userId: 1} = {user_id: 1}
 */
function normalizeFields(camelCaseObject) {
  return Object.assign({}, ...Object.keys(camelCaseObject).map(key => {
    return { [key.replace(/(?<c>[A-Z])/g, '_$1').toLowerCase()]: camelCaseObject[key.toString()] };
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

  for (const person of persons) {

    person.person._userid = userID;
    person.pointOfContact.userid = userID;

    person.person = normalizeFields(person.person);
    person.pointOfContact = normalizeFields(person.pointOfContact);

    for (let tag of person.tags) {
      tag.userid = userID;
      tag = normalizeFields(tag);
    }
  }
  return { message: normalizeFields(message), persons };
}

module.exports = {
  prepareContacts,
  logInsertionError
};