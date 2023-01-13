const hashHelpers = require('../utils/helpers/hashHelpers');

class ImapUser {
  constructor(query) {
    this.query = query;
  }

  /**
   * getUserConnetionDataFromQuery takes the query parameters from the URL and returns an object with the user's email, id, token,
   * refresh token, and port
   * @returns An object with the user's userIdentifierHash, email, id, token, refreshToken, and port.
   */
  getUserConnectionDataFromQuery() {
    
    if (this.query.access_token === undefined && this.query.password === undefined) {
      return {}; 
    }

    return (this.query.access_token)
      ? {
        email: this.query.email,
        id: this.query.id,
        userIdentifierHash: hashHelpers.hashEmail(this.query.email,this.query.id),
        token: this.query.access_token,
        refreshToken: this.query.refresh_token,
        port: 993
      }
      : {
        email: this.query.email,
        id: this.query.id,
        userIdentifierHash: hashHelpers.hashEmail(this.query.email,this.query.id),
        host: this.query.host,
        port: this.query.port,
        password: this.query.password
      };
  }
}

module.exports = ImapUser;
