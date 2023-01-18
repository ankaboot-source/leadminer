const Imap = require('imap');
const {
  imapAuthTimeout,
  imapConnectionTimeout
} = require('../config/server.config');
const tokenHelpers = require('../utils/helpers/tokenHelpers');

class ImapConnectionProvider {
  #imapConfig;

  /**
   * ImapConnectionProvider constructor.
   * @param {string} email - User email address.
   */
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

  /**
   * Builds the IMAP connection provider with password access.
   * @param {string} password - Email password.
   * @param {string} host - IMAP host.
   * @param {number} port - IMAP Port number. Defaults to 993.
   * @returns {ImapConnectionProvider}
   */
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

  /**
   * Builds the IMAP connection provider with Google API access.
   * @param {string} token - User access token.
   * @param {string} refreshToken - User refresh token.
   * @param {object} sseSender - sseSender to send the new generated token.
   * @param {string} userId - User Id.
   * @returns {Promise<ImapConnectionProvider>}
   */
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

  /**
   * Creates a new Imap connection.
   * @returns {Imap} - Imap connection object
   */
  getImapConnection() {
    return new Imap(this.#imapConfig);
  }
}

module.exports = {
  ImapConnectionProvider
};
