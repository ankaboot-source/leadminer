import { Pool } from 'pg';
import ENV from '../../config';

const pool = new Pool({
  connectionString: ENV.PG_CONNECTION_STRING,
  max: 10
});

export default pool;
