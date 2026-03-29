import { Client } from 'pg';
import { PostgreSQLMiningSourceCredentials } from '../../db/interfaces/MiningSources';

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
}

export async function testPostgresConnection(
  credentials: PostgreSQLMiningSourceCredentials
): Promise<ConnectionTestResult> {
  const client = new Client({
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    user: credentials.username,
    password: credentials.password,
    ssl: credentials.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10_000
  });

  try {
    await client.connect();
    await client.query('SELECT 1 as test');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await client.end();
  }
}
