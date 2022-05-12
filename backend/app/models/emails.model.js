module.exports = (sequelize, Sequelize) => {
  const EmailsInfos = sequelize.define('emails_info', {
    email: {
      type: Sequelize.JSONB,
      unique: {
        msg: 'already exist',
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
    total: {
      type: Sequelize.INTEGER,
    },
    type: {
      type: Sequelize.ENUM('email header', 'email body'),
    },
  });
  EmailsInfos.associate = (models) => {
    EmailsInfos.belongsTo(models.imap_infos, {
      foreignKey: 'userId',
    });
  };
  return EmailsInfos;
};
