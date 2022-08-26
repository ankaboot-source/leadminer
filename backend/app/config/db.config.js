const config = require('config');
const POSTGRES_DB = config.get('server.postgres.name') ? config.get('server.postgres.name') : process.env.POSTGRES_DB;
const POSTGRES_PASSWORD = config.get('server.postgres.password') ? config.get('server.postgres.password') : process.env.POSTGRES_PASSWORD;
const POSTGRES_USER = config.get('server.postgres.user') ? config.get('server.postgres.user') : process.env.POSTGRES_USER;
const POSTGRES_HOST = config.get('server.postgres.host') ? config.get('server.postgres.host') : process.env.POSTGRES_HOST;
module.exports = {
  db: POSTGRES_DB,
  password: POSTGRES_PASSWORD,
  user: POSTGRES_USER,
  host: POSTGRES_HOST,
};
