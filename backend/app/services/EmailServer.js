const Imap = require("imap");
const logger = require("../utils/logger")(module);
const hashHelpers = require("../utils/hashHelpers");
const tokenHelpers = require("../utils/tokenHelpers");
class EmailServer {
  /**
   * The constructor function is a special function that is called when a new object is created
   * @param user - The user object that was passed to the constructor.
   */
  #connection;

  constructor(user) {
    this.user = user;
    this.mailHash = hashHelpers.hashEmail(user.email);
  }
  //mailHash = hashHelpers.hashEmail(this.user.email);
  /**
   * It returns an IMAP object that is used to connect to the user's email account
   * @returns An Imap object
   */
  initConnection() {
    logger.info(`Preparing imap connection for user : ${this.mailHash}`);

    this.#connection = new Imap({
      user: this.user.email,
      xoauth2: "",
      host: "imap.gmail.com",
      port: this.user.connectionMethod.port || 993,
      tls: true,
      tlsOptions: {
        port: this.user.connectionMethod.port || 993,
        host: "imap.gmail.com",
        servername: "imap.gmail.com",
      },
      keepalive: false,
    });
    logger.info(
      `API connection to imap server initiated for user: ${this.mailHash}`
    );
    if (this.user.connectionMethod.method == "imap") {
      this.#connection = new Imap({
        user: this.user.email,
        password: this.user.password,
        host: this.user.connectionMethod.host,
        port: this.user.connectionMethod.port || 993,
        tls: true,
        connTimeout: process.env.CONNECTION_TIMEOUT || 20000,
        keepalive: false,
        authTimeout: process.env.AUTHENTICATION_TIMEOUT || 7000,
        tlsOptions: {
          port: this.user.connectionMethod.port || 993,
          host: this.user.connectionMethod.host,
          servername: this.user.connectionMethod.host,
        },
      });
      logger.info(
        `IMAP connection to imap server initiated for user: ${this.mailHash}`
      );
    }
  }
  /**
   * It kills the connection to the IMAP server
   * @param imapConnetion - The connection object returned by the imap.connect() function.
   */
  killConnection() {
    this.connection.destroy();
    logger.info(
      `Connection to imap server destroyed by user: ${this.mailHash}`
    );
  }
  isApiConnection() {
    if (this.user) {
      return true;
    } else {
      return false;
    }
  }
  async connecte() {
    return new Promise(async (res, reject) => {
      this.initConnection();
      console.log(this.isApiConnection());
      if (this.isApiConnection()) {
        console.log("heh", this.user);
        let tokens = await tokenHelpers.generateXOauthToken(this.user);
        this.#connection._config.xoauth2 = tokens.xoauth2Token;
        this.#connection.connect();
        res(this.#connection);
      } else {
        this.#connection.connect();
        res(this.#connection);
      }
    });
  }
}

module.exports = EmailServer;
