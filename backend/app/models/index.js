const Sequelize = require("sequelize");
const dbConfig = require("../config/db.config");
const logger = require("../utils/logger")(module);
const sequelize = new Sequelize(dbConfig.db, "postgres", dbConfig.password, {
  host: "localhost",
  dialect: "postgres",
  pool: {
    max: 50,
    min: 0,
    acquire: 80000,
    idle: 10000,
  },
  retry: {
    match: [/Deadlock/i],
    max: 3, // Maximum rety 3 times
    backoffBase: 1000, // Initial backoff duration in ms. Default: 100,
    backoffExponent: 1.5, // Exponent to increase backoff each try. Default: 1.1
  },
  logging: false,
});
logger.debug("creating database tables...");
const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.imapInfo = require("./imap.model")(sequelize, Sequelize);
db.emails = require("./emails.model")(sequelize, Sequelize);
db.emailsRaw = require("./emailsRaw.model")(sequelize, Sequelize);
db.Messages = require("./messages.model")(sequelize, Sequelize);
db.googleUsers = require("./googleUser.model")(sequelize, Sequelize);

module.exports = db;
