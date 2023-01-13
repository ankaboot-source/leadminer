const Imap = require('imap');
const logger = require('../utils/logger')(module);
const tokenHelpers = require('../utils/helpers/tokenHelpers');
const {
  imapAuthTimeout,
  imapConnectionTimeout
} = require('../config/server.config');
const { googleImapHost } = require('../config/google.config');

class EmailServer {
  #connection;
  /**
   * The constructor function is a special function that is called when a new object is created
   * @param user - The user object that was passed to the constructor.
   */
  constructor(user, sse) {
    this.user = user;
    this.sse = sse;
  }
  /**
   * initConnection returns an IMAP object that is used to connect to the user's email account
   * @returns An Imap object
   */
  initConnection() {
    logger.info('Preparing IMAP connection for user.', {
      user: this.user.userIdentifierHash
    });
    if (this.user.token) {
      // the user is connected using api
      this.#connection = new Imap({
        user: this.user.email,
        xoauth2: '',
        host: googleImapHost,
        port: this.user.port || 993,
        tls: true,
        tlsOptions: {
          port: this.user.port || 993,
          host: googleImapHost,
          servername: googleImapHost
        },
        keepalive: false
      });
      logger.info('API connection to IMAP server initiated for user.', {
        user: this.user.userIdentifierHash
      });
    }
    if (this.user.password) {
      // the user is connected using password
      this.#connection = new Imap({
        user: this.user.email,
        password: this.user.password,
        host: this.user.host,
        port: this.user.port || 993,
        tls: true,

        connTimeout: imapConnectionTimeout,
        keepalive: false,
        authTimeout: imapAuthTimeout,
        tlsOptions: {
          port: this.user.port || 993,
          host: this.user.host,
          servername: this.user.host
        }
      });
      logger.info('IMAP connection to IMAP server initiated for user.', {
        user:this.user.userIdentifierHash
      });
    }
  }
  /**
   * If the user has a token, return true, otherwise return false
   * @returns A boolean value.
   */
  isApiConnection() {
    if (this.user.token) {
      return true;
    }
    return false;
  }
  /**
   * connect() open a connection to the IMAP server
   * @returns A promise that resolves to the connection object.
   */
  async connect() {
    performance.mark('imapConn-start');
    this.initConnection();

    if (this.isApiConnection()) {
      const { newToken, xoauth2Token } = await tokenHelpers.generateXOauthToken(
        this.user
      );
      this.sse.send({ token: newToken }, `token${this.user.id}`);
      this.#connection._config.xoauth2 = xoauth2Token;
    } else {
      logger.info('User connected using IMAP.', {
        user: this.user.userIdentifierHash,
        duration: performance.measure('imap connection', 'imapConn-start')
          .duration
      });
    }

    this.#connection.connect();
    return this.#connection;
  }
}

module.exports = EmailServer;
