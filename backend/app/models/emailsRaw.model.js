//const uuid = require('uuid');
module.exports = (sequelize, Sequelize) => {
  const EmailsRaw = sequelize.define('emails_raw', {
    email_id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    message_id: {
      allowNull: true,
      type: Sequelize.STRING,
      references: {
        model: 'messages',
        key: 'message_id',
      },
    },
    from: { type: Sequelize.BOOLEAN },
    reply_to: { type: Sequelize.BOOLEAN },

    to: { type: Sequelize.BOOLEAN },

    cc: { type: Sequelize.BOOLEAN },

    bcc: { type: Sequelize.BOOLEAN },

    body: { type: Sequelize.BOOLEAN },

    name: { type: Sequelize.STRING, defaultValue: '' },
    address: { type: Sequelize.STRING },
    date: { type: Sequelize.STRING },
    transactional: { type: Sequelize.BOOLEAN },
    conversation: { type: Sequelize.INTEGER },
    newsletter: { type: Sequelize.BOOLEAN },
  });
  EmailsRaw.associate = (models) => {
    EmailsRaw.belongsTo(models.Messages, {
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      foreignKey: {
        name: 'message_id',
        allowNull: false,
      },
    });
  };

  return EmailsRaw;
};
