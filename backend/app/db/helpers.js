const logger = require('../utils/logger')(module);

const MAPPING_TABLE = new Map();

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
 * Converts a string in snake_case to CamelCase, but leaves the "_" character at the beginning of the string unchanged.
 * @param {string} str - The string to be converted.
 * @returns {string} - The converted string in CamelCase.
 */
function toCamelCase(str) {
  const underscore = str[0] === '_' ? '_' : '';
  const newStr = str[0] === '_' ? str.slice(1) : str;
  return (
    underscore +
    newStr.replace(/_([a-z])/g, (_, capturedGroup) => {
      return capturedGroup.toUpperCase();
    })
  );
}

/**
 * Transcodes an object keys from snake_case to CamelCase
 * @param {Object} sqlObject - The object to be transcoded
 * @returns {Object} - The transcoded object
 */
function transcodeSQL(sqlObject) {
  const newObj = {};
  Object.keys(sqlObject).forEach((CamleCase) => {
    if (MAPPING_TABLE.has(CamleCase)) {
      const snakeCaseField = MAPPING_TABLE.get(CamleCase);
      newObj[`${snakeCaseField}`] = sqlObject[`${CamleCase}`];
    }
  });
  return newObj;
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

    person.person = transcodeSQL(person.person);
    person.pointOfContact = transcodeSQL(person.pointOfContact);

    for (let tag of person.tags) {
      tag.userid = userID;
      tag = transcodeSQL(tag);
    }
  }
  return { message: transcodeSQL(message), persons };
}

module.exports = {
  MAPPING_TABLE,
  toCamelCase,
  prepareContacts,
  logInsertionError
};
