const Imap = require("imap");

class EmailServer {
  constructor(user) {
    this.user = user;
  }
  getConnection() {
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
  killConnection(imapConnetion) {
    imapConnetion.destroy();
  }

  refreshConnection() {
    let tokens = tokenHelpers.generateXOauthToken(this.user);
    return tokens;
  }
}

module.exports = EmailServer;
