const { connectionType } = require('../config/supabase.config');
const { Postgres } = require('./node-postgres');
const { SupabaseHandlers } = require('./supabase');
const logger = require('../utils/logger')(module);

function getDb() {
  switch (connectionType) {
    case 'native':
      return new Postgres(logger);
    case 'pgrest':
      return new SupabaseHandlers();
    default:
      break;
  }
}

const db = getDb();

module.exports = { db };
