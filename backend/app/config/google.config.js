const config = require('config');

const host = process.env.GOOGLE_IMAP_HOST ?? config.get('google_api.host');
const id = process.env.GOOGLE_CLIENT_ID ?? config.get('google_api.client.id');
const secret =
  process.env.GOOGLE_SECRET ?? config.get('google_api.client.secret');

module.exports = {
  googleImapHost: host,
  googleClientId: id,
  googleClientSecret: secret
};
