const config = require('config');

const { imap_email, imap_host, imap_password } = config.get('test');

module.exports = {
  testImapEmail: imap_email,
  testImapHost: imap_host,
  testImapPassword: imap_password
};
