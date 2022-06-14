module.exports = (sequelize, Sequelize) => {
  const EmailsInfos = sequelize.define("emails_info", {
    user: {
      allowNull: false,
      primaryKey: true,
      type: Sequelize.DataTypes.STRING,
    },
    address: {
      type: Sequelize.STRING,
      unique: {
        msg: "already exist",
      },
    },
    name: {
      type: Sequelize.STRING,
    },
    field: {
      type: Sequelize.ARRAY(Sequelize.STRING),
    },
    msgId: {
      type: Sequelize.ARRAY(Sequelize.INTEGER),
    },
    folder: {
      type: Sequelize.ARRAY(Sequelize.STRING),
    },
    dnsValidity: {
      type: Sequelize.STRING,
    },
    total: {
      type: Sequelize.INTEGER,
    },
    type: {
      type: Sequelize.ENUM("email header", "email body"),
    },
  });
  EmailsInfos.associate = (models) => {
    EmailsInfos.belongsTo(models.imap_infos, {
      foreignKey: "userId",
    });
  };
  return EmailsInfos;
};
