module.exports = (sequelize, Sequelize) => {
  const Messages = sequelize.define("messages", {
    message_id: {
      allowNull: false,
      primaryKey: true,
      type: Sequelize.STRING,
    },
    isNewsletter: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    isTransactional: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    isInConversation: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
  });
  Messages.associate = (models) => {
    Messages.hasMany(models.emailsRaw, { foreignKey: "message_id" });
  };
  return Messages;
};
