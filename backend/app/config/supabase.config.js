const config = require('config');

const supabaseUrl =
  process.env.SUPABASE_ID ?? config.get('server.supabase.url');

const supabaseToken =
  process.env.SUPABASE_TOKEN ?? config.get('server.supabase.token');

module.exports = {
  supabaseUrl,
  supabaseToken
};
