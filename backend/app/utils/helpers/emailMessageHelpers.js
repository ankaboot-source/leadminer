/**
 * Gets the first matching header value from a list of header fields if it exists.
 * @param {Object} Header - Header object.
 * @param {string[]} headerFields - A list of possible header fields.
 * @returns Header value or null.
 */
function getSpecificHeader(header, headerFields) {
  for (const headerField of headerFields) {
    const firstMatch =
      header[`${headerField}`] || header[`${headerField.toLocaleLowerCase()}`];

    if (firstMatch !== undefined) {
      return firstMatch;
    }
  }
  return null;
}

/**
 * Checks if a particular header field has a value from a given list of possible values
 * @param {Object} Header - Header object.
 * @param {string} headerField - A list of possible header fields.
 * @param {string[]} headerValues - A list of possible header values.
 * @returns {Boolean}
 */
function hasHeaderWithValue(header, headerField, headerValues) {
  const headerValue = getSpecificHeader(header, [headerField]);
  return (
    headerValue &&
    headerValues.some((value) =>
      headerValue[0].toLocaleLowerCase().includes(value)
    )
  );
}

/**
 * Checks if a particular header field has a value from a given list of possible values
 * @param {Object} Header - Header object.
 * @param {string[]} headerFieldPrefixes - A list of possible header keys.
 * @returns {Boolean}
 */
function hasHeaderFieldStartsWith(header, headerFieldPrefixes) {
  const headerFields = Object.keys(header);
  return headerFields.some((field) =>
    headerFieldPrefixes.some((prefix) => field.toLowerCase().startsWith(prefix))
  );
}

module.exports = {
  getSpecificHeader,
  hasHeaderWithValue,
  hasHeaderFieldStartsWith
};
