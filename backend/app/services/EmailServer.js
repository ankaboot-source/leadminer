const Imap = require('imap');
const logger = require('../utils/logger')(module);
const hashHelpers = require('../utils/hashHelpers');
const tokenHelpers = require('../utils/tokenHelpers');
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
    this.mailHash = hashHelpers.hashEmail(user.email);
  }
  /**
   * initConnection returns an IMAP object that is used to connect to the user's email account
   * @returns An Imap object
   */
  initConnection() {
    logger.info('Preparing IMAP connection for user.', {
      emailHash: this.mailHash
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
        emailHash: this.mailHash
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
        emailHash: this.mailHash
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
   * connecte() open a connection to the IMAP server
   * @returns A promise that resolves to the connection object.
   */
  async connecte() {
    return new Promise((res) => {
      // initialize the connection
      this.initConnection();
      if (this.isApiConnection()) {
        logger.debug('User connected using api');
        tokenHelpers.generateXOauthToken(this.user).then((tokens) => {
          this.sse.send({ token: tokens.newToken }, `token${this.user.id}`);
          this.#connection._config.xoauth2 = tokens.xoauth2Token;
          this.#connection.connect();
          res(this.#connection);
        });
      } else {
        logger.info('User connected using IMAP.', { emailHash: this.mailHash });
        this.#connection.connect();
        res(this.#connection);
      }
    });
  }
}

module.exports = EmailServer;
