/**
 * Extracts the x-imap-login header field and validates it
 * @param {Object} headers - an object containing all the headers
 * @returns {{data, error}} - an object containing the extracted values and an error object if any
 */
function getXImapHeaderField(headers) {
  if (!headers['x-imap-login']) {
    return { data: null, error: new Error('An x-imap-login header field is required.') };
  }
  let login = null;
  try {
    login = JSON.parse(headers['x-imap-login']);
  } catch (error) {
    return { data: null, error: new Error('x-imap-login header field is not in correct JSON format') };
  }

  if (!login.email || !login.id) {
    return { data: null, error: new Error('x-imap-login header field is missing required fields (email, id)') };
  }
  if (!login.access_token && !login.password) {
    return { data: null, error: new Error('x-imap-login header field is missing the access_token or password field') };
  }
  return { data: login, error: null };
}

module.exports = {
  getXImapHeaderField
};