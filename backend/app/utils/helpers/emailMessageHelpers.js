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

module.exports = {
  getSpecificHeader
};
