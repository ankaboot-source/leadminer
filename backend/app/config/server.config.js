const config = require('config');

const { port, hash_secret, log_level } = config.get('server');

module.exports = {
  serverPort: port,
  hashSecret: hash_secret,
  logLevel: log_level
};
