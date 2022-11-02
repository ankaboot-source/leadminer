const config = require('config');

const testImapEmail = config.has('test.imap_email')
  ? config.get('test.imap_email')
  : process.env.TEST_IMAP_EMAIL;

const testImapHost = config.has('test.imap_host')
  ? config.get('test.imap_host')
  : process.env.TEST_IMAP_HOST;

const testImapPassword = config.has('test.imap_password')
  ? config.get('test.imap_password')
  : process.env.TEST_IMAP_PASSWORD;

module.exports = {
  testImapEmail,
  testImapHost,
  testImapPassword
};
