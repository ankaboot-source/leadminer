const config = require('config');

const { host } = config.get('google_api');
const { id, secret } = config.get('google_api.client');

module.exports = {
  googleHost: host,
  googleClientId: id,
  googleClientSecret: secret
};
