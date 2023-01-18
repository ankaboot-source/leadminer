const Imap = require('imap');
const {
  imapAuthTimeout,
  imapConnectionTimeout
} = require('../config/server.config');
const tokenHelpers = require('../utils/helpers/tokenHelpers');

class ImapConnectionProvider {
  #imapConfig;

  constructor(email) {
    this.#imapConfig = {
      user: email,
      connTimeout: imapConnectionTimeout,
      authTimeout: imapAuthTimeout,
      port: 993,
      tls: true,
      keepalive: false
    };
  }

  withPassword(password, host, port = 993) {
    this.#imapConfig = {
      ...this.#imapConfig,
      password,
      host,
      port,
      tlsOptions: {
        port,
        host,
        servername: host
      }
    };
    return this;
  }

  async withGoogle(token, refreshToken, sseSender, userId) {
    this.#imapConfig = {
      ...this.#imapConfig,
      host: 'imap.gmail.com',
      port: 993,
      tlsOptions: {
        port: 993,
        host: 'imap.gmail.com',
        servername: 'imap.gmail.com'
      }
    };

    const { newToken, xoauth2Token } = await tokenHelpers.generateXOauthToken({
      token,
      refreshToken,
      email: this.#imapConfig.user
    });

    sseSender.send({ token: newToken }, `token${userId}`);
    this.#imapConfig.xoauth2 = xoauth2Token;

    return this;
  }

  getImapConnection() {
    return new Imap(this.#imapConfig);
  }
}

module.exports = {
  ImapConnectionProvider
};
