const { connectionType } = require('../config/supabase.config');
const { Postgres } = require('./node-postgres');
const { SupabaseHandlers } = require('./supabase');
const logger = require('../utils/logger')(module);

let db;
switch (connectionType) {
  case 'native':
    db = new Postgres(logger);
    break;
  case 'pgrest':
    db = new SupabaseHandlers();
    break;
  default:
    break;
}

module.exports = { db };
