const Imap = require("imap");

class EmailServer {
  /**
   * The constructor function is a special function that is called when a new object is created
   * @param user - The user object that was passed to the constructor.
   */
  constructor(user) {
    this.user = user;
  }
  /**
   * It returns an IMAP object that is used to connect to the user's email account
   * @returns An Imap object
   */
  getConnection() {
    console.log(this.user);
    let imap;
    if (this.user.connectionMethod.method == "api") {
      new Imap({
        user: this.user.email,
        xoauth2: this.user.token,
        host: this.user.connectionMethod.host,
        port: this.user.connectionMethod.port || 993,
        tls: true,
        tlsOptions: {
          port: this.user.connectionMethod.port || 993,
          host: this.user.connectionMethod.host,
          servername: this.user.connectionMethod.host,
        },
        keepalive: false,
      });
    } else if (this.user.connectionMethod.method == "imap") {
      imap = new Imap({
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
    }
    return imap;
  }
  /**
   * It kills the connection to the IMAP server
   * @param imapConnetion - The connection object returned by the imap.connect() function.
   */
  killConnection(imapConnetion) {
    imapConnetion.destroy();
  }

  /**
   * It generates a new XOauth token for the user
   * @returns A promise.
   */
  refreshConnection() {
    let tokens = tokenHelpers.generateXOauthToken(this.user);
    return tokens;
  }
}

module.exports = EmailServer;
