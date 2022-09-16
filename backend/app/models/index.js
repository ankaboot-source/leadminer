const Sequelize = require("sequelize");
const dbConfig = require("../config/db.config"),
  logger = require("../utils/logger")(module),
  // initialize a new connection to the DB
  sequelize = new Sequelize(dbConfig.db, dbConfig.user, dbConfig.password, {
    host: dbConfig.host,
    dialect: "postgres",
    pool: {
      max: 7, //Maximum number of connection in pool(do not make more than 7 for the moment, else the query queue became full in a short time and this will carsh the DB)
      min: 0,
      acquire: 200000,
      idle: 50000,
      idleTimeoutMillis: 0,
      connectionTimeoutMillis: 0,
    },
    retry: {
      match: [/Deadlock/i],
      max: 5, // Maximum rety 3 times
      backoffBase: 2000, // Initial backoff duration in ms. Default: 100,
      backoffExponent: 1.5, // Exponent to increase backoff each try. Default: 1.1
    },
    logging: true,
  });
// if not created we will create all the tables
logger.debug("creating database tables...");
const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;
// import all models
db.imapInfo = require("./imap.model")(sequelize, Sequelize);
db.emailsRaw = require("./emailsRaw.model")(sequelize, Sequelize);
db.googleUsers = require("./googleUser.model")(sequelize, Sequelize);

module.exports = db;
