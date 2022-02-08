module.exports = (sequelize, Sequelize) => {
  const ImapInfo = sequelize.define("imapInfo", {
    email: {
      type: Sequelize.STRING,
    },
    host: {
      type: Sequelize.STRING,
    },
    port: {
      type: Sequelize.INTEGER,
    },
    tls: {
      type: Sequelize.BOOLEAN,
    },
  });

  return ImapInfo;
};
