const { Pool, Client } = require('pg');
const { pgConnectionString } = require('../../config/supabase.config');

const pool = new Client({
  connectionString: pgConnectionString
});

module.exports = {
  async query(text, params, logger) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.info('Executed query', { text, duration, rows: res.rowCount });
    return res;
  }
};
