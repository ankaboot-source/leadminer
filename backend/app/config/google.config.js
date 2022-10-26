const config = require('config');

const { host } = config.get('google_api');
const { id, secret } = config.get('google_api.client');

module.exports = {
  googleImapHost: host,
  googleClientId: id,
  googleClientSecret: secret
};
