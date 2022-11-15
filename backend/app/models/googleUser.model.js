/* This is creating a googleuser table in the database. */
module.exports = (sequelize, Sequelize) => {
  const googleUsers = sequelize.define('google_users', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: Sequelize.DataTypes.UUID,
      defaultValue: Sequelize.DataTypes.UUIDV4
    },
    email: {
      type: Sequelize.STRING
    },
    refreshToken: {
      type: Sequelize.STRING
    }
  });

  return googleUsers;
};
