import { Client } from 'pg';
import { PostgreSQLMiningSourceCredentials } from '../../db/interfaces/MiningSources';
import validateSelectQuery from '../../utils/helpers/sqlValidator';

export interface QueryPreviewResult {
  columns: string[];
  rows: Record<string, unknown>[];
  totalCount?: number;
}

export interface TableListItem {
  tablename: string;
  schema: string;
}

export interface QueryExecutionResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

const PREVIEW_LIMIT = 5;
const PREVIEW_TIMEOUT_MS = 30000;
const STREAM_TIMEOUT_MS = 300000;

function clampPreviewLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit <= 0) {
    return PREVIEW_LIMIT;
  }

  return Math.min(limit, PREVIEW_LIMIT);
}

function sanitizeQuery(query: string): string {
  return query.trim().replace(/;$/, '');
}

function getSafeSelectQuery(query: string): string {
  const validationError = validateSelectQuery(query);
  if (validationError) {
    throw new Error(validationError);
  }

  const sanitizedQuery = sanitizeQuery(query);
  if (sanitizedQuery.includes(';')) {
    throw new Error('Only a single SELECT statement is allowed');
  }

  return sanitizedQuery;
}

async function rollbackIfNeeded(
  client: Client,
  shouldRollback: boolean
): Promise<void> {
  if (!shouldRollback) {
    return;
  }

  try {
    await client.query('ROLLBACK');
  } catch {
    // ignore rollback errors to preserve original failure
  }
}

async function closeClientSafely(client: Client): Promise<void> {
  try {
    await client.end();
  } catch {
    // ignore close errors to avoid masking query failures
  }
}

export class PostgresQueryService {
  constructor(
    private readonly credentials: PostgreSQLMiningSourceCredentials
  ) {}

  private createClient(statementTimeout: number): Client {
    const sslEnabled = this.credentials.ssl ?? true;
    return new Client({
      host: this.credentials.host,
      port: this.credentials.port,
      database: this.credentials.database,
      user: this.credentials.username,
      password: this.credentials.password,
      ssl: sslEnabled ? { rejectUnauthorized: false } : false,
      statement_timeout: statementTimeout,
      connectionTimeoutMillis: 10000
    });
  }

  async previewQuery(
    query: string,
    limit: number = PREVIEW_LIMIT
  ): Promise<QueryPreviewResult> {
    const safeLimit = clampPreviewLimit(limit);
    const sanitizedQuery = getSafeSelectQuery(query);
    const limitedQuery = `SELECT * FROM (${sanitizedQuery}) AS leadminer_preview LIMIT ${safeLimit}`;

    const client = this.createClient(PREVIEW_TIMEOUT_MS);

    let shouldRollback = false;

    try {
      await client.connect();
      await client.query('BEGIN READ ONLY');
      shouldRollback = true;
      const result = await client.query(limitedQuery);
      await client.query('ROLLBACK');
      shouldRollback = false;

      return {
        columns: result.fields.map((field) => field.name),
        rows: result.rows,
        totalCount: result.rowCount ?? undefined
      };
    } catch (error) {
      await rollbackIfNeeded(client, shouldRollback);

      throw error;
    } finally {
      await closeClientSafely(client);
    }
  }

  async listTables(): Promise<TableListItem[]> {
    const client = this.createClient(PREVIEW_TIMEOUT_MS);

    let shouldRollback = false;

    try {
      await client.connect();
      await client.query('BEGIN READ ONLY');
      shouldRollback = true;

      const result = await client.query(`
        SELECT tablename, schemaname AS schema
        FROM pg_catalog.pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY schemaname, tablename
      `);

      await client.query('ROLLBACK');
      shouldRollback = false;

      return result.rows as TableListItem[];
    } catch (error) {
      await rollbackIfNeeded(client, shouldRollback);
      throw error;
    } finally {
      await closeClientSafely(client);
    }
  }

  async countRows(query: string): Promise<number> {
    const sanitizedQuery = getSafeSelectQuery(query);
    const countQuery = `SELECT COUNT(*) AS total FROM (${sanitizedQuery}) AS leadminer_count`;
    const client = this.createClient(PREVIEW_TIMEOUT_MS);

    let shouldRollback = false;

    try {
      await client.connect();
      await client.query('BEGIN READ ONLY');
      shouldRollback = true;
      const result = await client.query(countQuery);
      await client.query('ROLLBACK');
      shouldRollback = false;

      const total = result.rows[0]?.total;
      return typeof total === 'number' ? total : parseInt(total, 10);
    } catch (error) {
      await rollbackIfNeeded(client, shouldRollback);
      throw error;
    } finally {
      await closeClientSafely(client);
    }
  }

  async *executeQueryStream(
    query: string,
    batchSize: number = 1000
  ): AsyncGenerator<QueryExecutionResult> {
    const safeBatchSize =
      Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 1000;
    const sanitizedQuery = getSafeSelectQuery(query);
    const client = this.createClient(STREAM_TIMEOUT_MS);

    let shouldRollback = false;

    try {
      await client.connect();
      await client.query('BEGIN READ ONLY');
      shouldRollback = true;
      await client.query(
        `DECLARE leadminer_cursor NO SCROLL CURSOR FOR ${sanitizedQuery}`
      );

      while (true) {
        // Sequential FETCH calls are required for cursor-based streaming.
        // eslint-disable-next-line no-await-in-loop
        const result = await client.query(
          `FETCH ${safeBatchSize} FROM leadminer_cursor`
        );

        if (!result.rows.length) {
          break;
        }

        yield {
          columns: result.fields.map((field) => field.name),
          rows: result.rows,
          rowCount: result.rows.length
        };
      }

      await client.query('CLOSE leadminer_cursor');
      await client.query('COMMIT');
      shouldRollback = false;
    } catch (error) {
      await rollbackIfNeeded(client, shouldRollback);

      throw error;
    } finally {
      await closeClientSafely(client);
    }
  }
}
