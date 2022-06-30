const Sequelize = require('sequelize');
const dbConfig = require('../config/db.config');

const sequelize = new Sequelize(dbConfig.db, 'postgres', dbConfig.password, {
  host: 'localhost',
  dialect: 'postgres',
  pool: {
    max: 15,
    min: 0,
    acquire: 90000,
    idle: 30000,
  },
  retry: {
    match: [/Deadlock/i],
    max: 3, // Maximum rety 3 times
    backoffBase: 1000, // Initial backoff duration in ms. Default: 100,
    backoffExponent: 1.5, // Exponent to increase backoff each try. Default: 1.1
  },
  logging: false,
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.imapInfo = require('./imap.model')(sequelize, Sequelize);
db.emails = require('./emails.model')(sequelize, Sequelize);
db.emailsRaw = require('./emailsRaw.model')(sequelize, Sequelize);
db.Messages = require('./messages.model')(sequelize, Sequelize);

db.googleUsers = require('./googleUser.model')(sequelize, Sequelize);
Object.keys(db).forEach((modelName) => {
  console.log(modelName);
  if ('associate' in db[modelName]) {
    // console.log(models[modelName]);
    db[modelName].associate(db);
  }
});
module.exports = db;
