module.exports = (sequelize, Sequelize) => {
  const EmailsInfos = sequelize.define("emails_info", {
    // userId: {
    //   allowNull: false,
    //   type: Sequelize.UUID,
    //   foriegnKey: true,
    // },
    email: {
      type: Sequelize.JSONB,
      unique: {
        msg: "already exist",
      },
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
    // dnsDateCheck: {
    //   type: Sequelize.DATE,
    // },
    // smtpCode: {
    //   type: Sequelize.STRING,
    // },
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
