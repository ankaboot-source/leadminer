import { Pool } from 'pg';
import ENV from '../../config';
import logger from '../../utils/logger';

const pool = new Pool({
  connectionString: ENV.PG_CONNECTION_STRING,
  max: 10
});

pool.on('error', (error, client) => {
  logger.error('Error raised by pg-pool: ', (error as Error).message);
  client.release();
});

export default pool;
