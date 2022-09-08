class ImapUser {
  constructor(query) {
    this.query = query;
  }

  /**
   * It takes the query parameters from the URL and returns an object with the user's email, id, token,
   * refresh token, and port
   * @returns An object with the user's email, id, token, refreshToken, and port.
   */
  getUserConnetionDataFromQuery() {
    const user = {};

    if (this.query.access_token) {
      user.email = this.query.email;
      user.id = this.query.id;
      user.token = this.query.access_token;
      user.refreshToken = this.query.refresh_token;
      user.port = 993;
      return user;
    } else if (this.query.password) {
      user.email = this.query.email;
      user.id = this.query.id;
      user.password = this.query.password;
      user.host = this.query.host;
      user.port = this.query.port;
      return user;
    }
    return user;
    
  }
}

module.exports = ImapUser;
