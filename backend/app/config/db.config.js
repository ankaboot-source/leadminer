const config = require('config');

const POSTGRES_DB = process.env.PG_NAME ?? config.get('server.postgres.name');
const POSTGRES_PASSWORD =
  process.env.PG_PASSWORD ?? config.get('server.postgres.password');
const POSTGRES_USER = process.env.PG_USER ?? config.get('server.postgres.user');
const POSTGRES_HOST = process.env.PG_HOST ?? config.get('server.postgres.host');

/* Exporting the database information to be used in the server.js file. */
module.exports = {
  db: POSTGRES_DB,
  password: POSTGRES_PASSWORD,
  user: POSTGRES_USER,
  host: POSTGRES_HOST
};
