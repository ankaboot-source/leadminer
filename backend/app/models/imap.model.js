const uuid = require("uuid");
module.exports = (sequelize, Sequelize) => {
  const ImapInfo = sequelize.define("imap_info", {
    id: {
      allowNull: false,
      type: Sequelize.UUIDV4,
      primaryKey: true,
      defaultValue: uuid.v4(),
    },
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
  //ImapInfo.beforeCreate((user) => (user.id = uuid.v4()));
  return ImapInfo;
};
