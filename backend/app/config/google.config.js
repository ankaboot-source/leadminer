const config = require('config');

const id = process.env.GOOGLE_CLIENT_ID ?? config.get('google_api.client.id');
const secret =
  process.env.GOOGLE_SECRET ?? config.get('google_api.client.secret');

module.exports = {
  googleClientId: id,
  googleClientSecret: secret
};
