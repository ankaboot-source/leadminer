const redis = require('redis');
// initialise sse (server sent events)
const client = redis.createClient(6379);
client.connect();
/* A function that returns a sequelize model. */
module.exports = (sequelize, Sequelize) => {
  const Emails = sequelize.define('emails', {
    email_Id: {
      allowNull: false,
      type: Sequelize.STRING,
    },
    address: {
      type: Sequelize.TEXT,
      unique: true,
    },
    date: {
      type: Sequelize.STRING,
    },
  });
  return Emails;
};
