const dbConfig = require("../config/db.config.js");

const Sequelize = require("sequelize");
const sequelize = new Sequelize(dbConfig.DB, {
  dialect: "postgres" /* one of 'mysql' | 'mariadb' | 'postgres' | 'mssql' */,
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.imapInfo = require("./imap.model.js")(sequelize, Sequelize);

module.exports = db;
