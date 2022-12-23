const config = require('config');

const supabaseUrl =
  process.env.SUPABASE_PROJECT_URL ?? config.get('server.supabase.url');

const supabaseToken =
  process.env.SUPABASE_SECRET_PROJECT_TOKEN ??
  config.get('server.supabase.token');

const pgConnectionString =
  process.env.PG_CONNECTION_STRING ??
  config.get('server.supabase.connection_string');

const connectionType =
  process.env.CONNECTION_TYPE ?? config.get('server.supabase.connection_type');

const useBatch = process.env.USE_BATCH ?? config.get('server.supabase.use_batch');
const batchSize = process.env.BATCH_SIZE ?? config.get('server.supabase.batch_size');

module.exports = {
  supabaseUrl,
  supabaseToken,
  pgConnectionString,
  connectionType,
  useBatch,
  batchSize
};
