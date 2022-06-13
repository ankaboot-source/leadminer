class ImapUser {
  constructor(query) {
    this.query = query;
  }
  createUser(user) {
    Users.findOne({ where: { email: user.email } }).then((user) => {
      if (user === null) {
        Users.create(user)
          .then((user) => {
            return user;
          })
          .catch((err) => {
            logger.error(
              `Can't create account with user record for user with email : ${hashHelpers.hash(
                user.email
              )} : reason : ${err}`
            );
          });
      } else {
        logger.info(
          `User record with email ${hashHelpers.hash(user.email)} already exist`
        );
        return user;
      }
    });
  }
  updateUser(user) {
    User.update(user, { where: { email: user.email } }).then(() => {
      return user;
    });
  }
  getUserConnectionData(user) {
    Users.findOne({ where: { email: user.email } }).then((user) => {
      return user;
    });
  }

  getUserConnetionDataFromQuery() {
    let user = {};
    if (this.query.authCode) {
      user["email"] = this.query.email;
      user["token"] = this.query.token; //tokenHelpers.getAccessToken(this.query.authCode);
      user["connectionMethod"] = { method: "api" };
      user.connectionMethod.host = null;
      user.connectionMethod.port = null;
    } else if (this.query.password) {
      user["email"] = this.query.email;
      user["password"] = this.query.password;
      user["connectionMethod"] = { method: "imap" };
      user.connectionMethod.host = this.query.host;
      user.connectionMethod.port = this.query.port;
    }
    return user;
  }
}

module.exports = ImapUser;
