const config = require('config');

const { url, token } = config.get('server.supabase');

module.exports = {
  supabaseUrl: url,
  supabaseToken: token
};
