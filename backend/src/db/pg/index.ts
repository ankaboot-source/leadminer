import { Pool } from 'pg';
import { PG_CONNECTION_STRING } from '../../config';

const pool = new Pool({
  connectionString: PG_CONNECTION_STRING,
  max: 10
});

export default pool;
