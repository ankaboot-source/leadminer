const Sequelize = require("sequelize");
const dbConfig = require("../config/db.config");

const sequelize = new Sequelize(dbConfig.db, "postgres", dbConfig.password, {
  host: "localhost",
  dialect: "postgres",
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

db.imapInfo = require("./imap.model")(sequelize, Sequelize);
db.emailsInfos = require("./emails.model")(sequelize, Sequelize);

module.exports = db;
