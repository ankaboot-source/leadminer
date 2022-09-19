const Imap = require("imap"),
  logger = require("../utils/logger")(module);
const hashHelpers = require("../utils/hashHelpers");
const tokenHelpers = require("../utils/tokenHelpers");
const config = require("config"),
  GOOGLE_IMAP_HOST = config.get("google_api.host"),
  AUTHENTICATION_TIMEOUT = config.get("server.imap.authentication_timeout"),
  CONNECTION_TIMEOUT = config.get("server.imap.connection_timeout");

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
    logger.info(`Preparing imap connection for user : ${this.mailHash}`);

    if (this.user.token) {
      // the user is connected using api
      this.#connection = new Imap({
        user: this.user.email,
        xoauth2: "",
        host: GOOGLE_IMAP_HOST,
        port: this.user.port || 993,
        tls: true,
        tlsOptions: {
          port: this.user.port || 993,
          host: GOOGLE_IMAP_HOST,
          servername: GOOGLE_IMAP_HOST,
        },
        keepalive: false,
      });
      logger.info(
        `API connection to imap server initiated for user: ${this.mailHash}`
      );
    }
    if (this.user.password) {
      // the user is connected using password
      this.#connection = new Imap({
        user: this.user.email,
        password: this.user.password,
        host: this.user.host,
        port: this.user.port || 993,
        tls: true,
        connTimeout: CONNECTION_TIMEOUT,
        keepalive: false,
        authTimeout: AUTHENTICATION_TIMEOUT,
        tlsOptions: {
          port: this.user.port || 993,
          host: this.user.host,
          servername: this.user.host,
        },
      });
      logger.info(
        `IMAP connection to imap server initiated for user: ${this.mailHash}`
      );
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
    return new Promise(async (res, reject) => {
      // initialize the connection
      this.initConnection();
      if (this.isApiConnection()) {
        logger.debug("User connected using api");
        const tokens = await tokenHelpers.generateXOauthToken(this.user);
        this.sse.send({ token: tokens.newToken }, `token${this.user.id}`);
        this.#connection._config.xoauth2 = tokens.xoauth2Token;
        this.#connection.connect();
        res(this.#connection);
      } else {
        logger.info(`User connected using imap: ${this.mailHash}`);

        this.#connection.connect();
        res(this.#connection);
      }
    });
  }
}

module.exports = EmailServer;
