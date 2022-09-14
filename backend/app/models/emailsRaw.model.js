/* Creating EmailsRaws table in the database. */
module.exports = (sequelize, Sequelize) => {
  const EmailsRaw = sequelize.define("emails_raw", {
    email_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      allowNull: false,
      type: Sequelize.STRING,
    },
    from: { type: Sequelize.BOOLEAN },
    reply_to: { type: Sequelize.BOOLEAN },

    to: { type: Sequelize.BOOLEAN },

    cc: { type: Sequelize.BOOLEAN },

    bcc: { type: Sequelize.BOOLEAN },

    body: { type: Sequelize.BOOLEAN },

    name: { type: Sequelize.STRING, defaultValue: "" },
    address: { type: Sequelize.STRING },
    date: { type: Sequelize.STRING },
    domain_type: { type: Sequelize.STRING },
    domain_name: { type: Sequelize.STRING },
    transactional: { type: Sequelize.BOOLEAN },
    conversation: { type: Sequelize.INTEGER },
    newsletter: { type: Sequelize.BOOLEAN },
  });
  return EmailsRaw;
};
