module.exports = (sequelize, Sequelize) => {
  const EmailsInfos = sequelize.define("emails_info", {
    email: {
      type: Sequelize.JSONB,
      unique: {
        msg: "your-message-here",
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
    dnsValididty: {
      type: Sequelize.STRING,
    },
    // dnsDateCheck: {
    //   type: Sequelize.DATE,
    // },
    // smtpCode: {
    //   type: Sequelize.STRING,
    // },
    type: {
      type: Sequelize.ENUM("email header", "email body"),
    },
  });

  return EmailsInfos;
};
