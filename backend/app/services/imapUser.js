class ImapUser {
  constructor(query) {
    this.query = query;
  }
  // createUser(user) {
  //   Users.findOne({ where: { email: user.email } }).then((user) => {
  //     if (user === null) {
  //       Users.create(user)
  //         .then((user) => {
  //           return user;
  //         })
  //         .catch((err) => {
  //           logger.error(
  //             `Can't create account with user record for user with email : ${hashHelpers.hash(
  //               user.email
  //             )} : reason : ${err}`
  //           );
  //         });
  //     } else {
  //       logger.info(
  //         `User record with email ${hashHelpers.hash(user.email)} already exist`
  //       );
  //       return user;
  //     }
  //   });
  // }
  // updateUser(user) {
  //   User.update(user, { where: { email: user.email } }).then(() => {
  //     return user;
  //   });
  // }
  // getUserConnectionData(user) {
  //   Users.findOne({ where: { email: user.email } }).then((user) => {
  //     return user;
  //   });
  // }

  /**
   * It takes the query parameters from the URL and returns an object with the user's email, id, token,
   * refresh token, and port
   * @returns An object with the user's email, id, token, refreshToken, and port.
   */
  getUserConnetionDataFromQuery() {
    const user = {};
    if (this.query.access_token) {
      user['email'] = this.query.email;
      user['id'] = this.query.id;
      user['token'] = this.query.access_token;
      user['refreshToken'] = this.query.refresh_token;
      user['port'] = 993;
    } else if (this.query.password) {
      user['email'] = this.query.email;
      user['id'] = this.query.id;
      user['password'] = this.query.password;
      user['host'] = this.query.host;
      user['port'] = this.query.port;
    }
    return user;
  }
}

module.exports = ImapUser;
