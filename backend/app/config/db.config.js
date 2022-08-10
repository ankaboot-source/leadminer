const config = require("config");
const POSTGRES_DB = config.get("server.postgres.name");
const POSTGRES_PASSWORD = config.get("server.postgres.password");
const POSTGRES_USER = config.get("server.postgres.user");
module.exports = {
  db: POSTGRES_DB,
  password: POSTGRES_PASSWORD,
  user: POSTGRES_USER,
};
