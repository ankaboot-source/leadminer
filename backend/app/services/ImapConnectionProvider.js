const Imap = require('imap');
const {
  imapAuthTimeout,
  imapConnectionTimeout
} = require('../config/server.config');
const tokenHelpers = require('../utils/helpers/tokenHelpers');

class ImapConnectionProvider {

  /**
   * @typedef {Object} ImapConnectionProviderConfig
   * @property {string} [id] - A unique identifier for the connection
   * @property {string} [password] - User's password for non-OAuth connections
   * @property {string} [host] - The host name or IP address of the mail server
   * @property {number} [port] - The port number of the mail server (default: 993)
   * @property {string} [access_token] - OAuth access token for connecting to Google
   * @property {string} [refresh_token] - OAuth refresh token for connecting to Google
   * @property {Object} [sse] - A server sent event (SSE) instance.
   */

  #imapConfig;

  /**
   * ImapConnectionProvider constructor.
   * @constructor
   * @param {string} email - User email address
   */
  constructor(email) {
    this.#imapConfig = {
      user: email,
      connTimeout: imapConnectionTimeout,
      authTimeout: imapAuthTimeout,
      tls: true,
      keepalive: false
    };
  }

  /**
   * Builds the configuration object for the connection.
   * @private
   * @param {ImapConnectionProviderConfig} config - Configuration object for the connection
   * @returns {Object} - The configuration object for the connection
   */
  async initConnection({ id, password, host, port = 993, access_token, refresh_token, sse }) {

    const connectionConfig = access_token
      ? await ImapConnectionProvider._withGoogle(this.#imapConfig.user, access_token, refresh_token, id, sse)
      : ImapConnectionProvider._withPassword(host, password, port);

    this.#imapConfig = {
      ...this.#imapConfig,
      ...connectionConfig
    };
    return this;
  }
  /**
   * Builds the configuration for connecting to Google using OAuth.
   * @param {string} email - User's email address
   * @param {string} token - OAuth access token
   * @param {string} refreshToken - OAuth refresh token
   * @param {string} userId - A unique identifier for the connection
   * @returns {Object} - The configuration object for the connection
  */
  static async _withGoogle(email, token, refreshToken, userId, sse) {
    const googleConfig = {
      host: 'imap.gmail.com',
      port: 993,
      tlsOptions: {
        host: 'imap.gmail.com',
        port: 993,
        servername: 'imap.gmail.com'
      }
    };
    const { newToken, xoauth2Token } = await tokenHelpers.generateXOauthToken({
      token,
      refreshToken,
      email
    });
    googleConfig.xoauth2 = xoauth2Token;
    sse.send({ token: newToken }, `token${userId}`);
    return googleConfig;
  }

  /**
   * Builds the configuration for connecting to a mail server using a username and password.
   * @param {string} host - The host name or IP address of the mail server
   * @param {string} password - User's password
   * @returns {Object} - The configuration object for the connection
  */
  static _withPassword(host, password, port = 993) {
    return {
      password,
      host,
      port,
      tlsOptions: {
        port,
        host,
        servername: host
      }
    };
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
