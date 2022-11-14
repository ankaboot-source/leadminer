const config = require('config');

const supabaseUrl =
  process.env.SUPABASE_PROJECT_URL ?? config.get('server.supabase.url');

const supabaseToken =
  process.env.SUPABASE_SECRET_PROJECT_TOKEN ??
  config.get('server.supabase.token');

module.exports = {
  supabaseUrl,
  supabaseToken
};
