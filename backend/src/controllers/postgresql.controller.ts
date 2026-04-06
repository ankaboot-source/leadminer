import { User } from '@supabase/supabase-js';
import { Request, Response } from 'express';
import {
  MiningSources,
  PostgreSQLMiningSourceCredentials,
  MiningSource
} from '../db/interfaces/MiningSources';
import { ContactFormat } from '../services/extractors/engines/FileImport';
import {
  PostgresQueryService,
  QueryPreviewResult,
  TableListItem
} from '../services/postgresql/PostgresQueryService';
import TasksManagerPostgreSQL from '../services/tasks-manager/TasksManagerPostgreSQL';
import { testPostgresConnection } from '../utils/helpers/postgresConnection';
import validateSelectQuery from '../utils/helpers/sqlValidator';
import validateType from '../utils/helpers/validation';
import logger from '../utils/logger';
import redis from '../utils/redis';
import RedisStreamProducer from '../utils/streams/redis/RedisStreamProducer';
import { EmailMessageData } from '../workers/email-message/emailMessageHandlers';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const CONTACT_FIELDS: (keyof ContactFormat)[] = [
  'email',
  'name',
  'given_name',
  'family_name',
  'alternate_name',
  'location',
  'works_for',
  'job_title',
  'same_as',
  'image'
];

export interface PostgresConnectionBody {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  saveConnection?: boolean;
  connectionName?: string;
}

export interface PostgresMiningBody {
  sourceId?: string;
  connection?: PostgreSQLMiningSourceCredentials;
  query: string;
  mapping?: Record<string, keyof ContactFormat>;
}

function getConnectionCredentials(
  body: PostgresConnectionBody
): PostgreSQLMiningSourceCredentials {
  return {
    host: body.host,
    port: body.port,
    database: body.database,
    username: body.username,
    password: body.password,
    ssl: body.ssl ?? true
  };
}

function normalizePostgresCredentials(
  credentials: PostgreSQLMiningSourceCredentials
): PostgreSQLMiningSourceCredentials {
  return {
    ...credentials,
    ssl: credentials.ssl ?? true
  };
}

function isPostgreSQLSource(source: MiningSource): boolean {
  return source.type === 'postgresql';
}

function isMatchingPostgreSQLSource(
  sourceId: string,
  source: MiningSource
): source is Extract<MiningSource, { type: 'postgresql' }> {
  return source.email === sourceId && isPostgreSQLSource(source);
}

async function resolvePostgresCredentials(
  userId: string,
  body: PostgresMiningBody,
  miningSources: MiningSources
): Promise<PostgreSQLMiningSourceCredentials | null> {
  if (body.connection) {
    return normalizePostgresCredentials(body.connection);
  }

  if (!body.sourceId) {
    return null;
  }

  const { sourceId } = body;

  const sources = await miningSources.getSourcesForUser(userId);
  const source = sources.find((item) =>
    isMatchingPostgreSQLSource(sourceId, item)
  );

  return source ? normalizePostgresCredentials(source.credentials) : null;
}

export function validatePostgresConnectionBody(body: unknown): string[] {
  const errors: Array<string | null> = [];

  if (!isRecord(body)) {
    return ['Invalid input payload'];
  }

  const b = body as Record<string, unknown>;

  errors.push(validateType('host', b.host, 'string'));
  errors.push(validateType('port', b.port, 'number'));
  errors.push(validateType('database', b.database, 'string'));
  errors.push(validateType('username', b.username, 'string'));
  errors.push(validateType('password', b.password, 'string'));

  if (
    typeof b.port === 'number' &&
    (!Number.isInteger(b.port) || b.port < 1 || b.port > 65535)
  ) {
    errors.push('port must be an integer between 1 and 65535');
  }

  if (b.saveConnection !== undefined && typeof b.saveConnection !== 'boolean') {
    errors.push('saveConnection must be a boolean');
  }

  if (
    b.saveConnection === true &&
    (typeof b.connectionName !== 'string' || !b.connectionName.trim())
  ) {
    errors.push('connectionName is required when saveConnection is enabled');
  }

  if (b.ssl !== undefined) {
    errors.push(validateType('ssl', b.ssl, 'boolean'));
  }

  return errors.filter(Boolean) as string[];
}

export function validatePostgresPreviewBody(body: unknown): string[] {
  const errors: Array<string | null> = [];

  if (!isRecord(body)) {
    return ['Invalid input payload'];
  }

  const b = body as Record<string, unknown>;

  if (!b.query || typeof b.query !== 'string') {
    errors.push('query is required');
  } else {
    const queryError = validateSelectQuery(b.query);
    if (queryError) {
      errors.push(queryError);
    }
  }

  if (
    b.sourceId !== undefined &&
    (typeof b.sourceId !== 'string' || !b.sourceId.trim())
  ) {
    errors.push('sourceId must be a non-empty string');
  }

  if (!b.sourceId && !b.connection) {
    errors.push('Either sourceId or connection is required');
  }

  if (b.connection) {
    errors.push(...validatePostgresConnectionBody(b.connection));
  }

  return errors.filter(Boolean) as string[];
}

export function validatePostgresMiningBody(body: unknown): string[] {
  const errors: Array<string | null> = [];

  if (!isRecord(body)) {
    return ['Invalid input payload'];
  }

  const b = body as Record<string, unknown>;

  if (!b.query || typeof b.query !== 'string') {
    errors.push('query is required');
  } else {
    const queryError = validateSelectQuery(b.query);
    if (queryError) {
      errors.push(queryError);
    }
  }

  if (!isRecord(b.mapping)) {
    errors.push('mapping is required');
  } else {
    const values = Object.values(b.mapping);

    if (!values.every((field) => typeof field === 'string')) {
      errors.push('mapping values must be valid contact fields');
    } else {
      const mappedFields = values as string[];

      if (!mappedFields.includes('email')) {
        errors.push('Email mapping is required');
      }

      const hasInvalidField = mappedFields.some(
        (field) => !CONTACT_FIELDS.includes(field as keyof ContactFormat)
      );

      if (hasInvalidField) {
        errors.push('mapping contains unsupported contact fields');
      }
    }
  }

  if (
    b.sourceId !== undefined &&
    (typeof b.sourceId !== 'string' || !b.sourceId.trim())
  ) {
    errors.push('sourceId must be a non-empty string');
  }

  if (!b.sourceId && !b.connection) {
    errors.push('Either sourceId or connection is required');
  }

  if (b.connection) {
    errors.push(...validatePostgresConnectionBody(b.connection));
  }

  return errors.filter(Boolean) as string[];
}

export default function initializePostgresqlController(
  miningSources: MiningSources,
  tasksManagerPostgreSQL: TasksManagerPostgreSQL,
  queryServiceFactory: (
    credentials: PostgreSQLMiningSourceCredentials
  ) => Pick<
    PostgresQueryService,
    'previewQuery' | 'listTables' | 'countRows'
  > = (credentials) => new PostgresQueryService(credentials)
) {
  return {
    async testConnection(req: Request, res: Response) {
      const user = res.locals.user as User;
      const { body } = req;

      try {
        const errors = validatePostgresConnectionBody(body);
        if (errors.length) {
          return res
            .status(400)
            .json({ message: `Invalid input: ${errors.join(', ')}` });
        }

        const validatedBody = body as PostgresConnectionBody;
        const credentials = getConnectionCredentials(validatedBody);
        const result = await testPostgresConnection(credentials);

        if (!result.success) {
          return res
            .status(400)
            .json({ message: result.error || 'Connection failed' });
        }

        if (validatedBody.saveConnection) {
          await miningSources.upsert({
            userId: user.id,
            email: validatedBody.connectionName!.trim(),
            type: 'postgresql',
            credentials
          });
        }

        return res.status(200).json({
          success: true,
          saved: Boolean(validatedBody.saveConnection)
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('PostgreSQL connection test failed', {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err)
        });
        return res
          .status(500)
          .json({ message: 'Unable to test PostgreSQL connection' });
      }
    },

    async previewQuery(req: Request, res: Response) {
      try {
        const { body } = req;
        const user = res.locals.user as User;
        const errors = validatePostgresPreviewBody(body);
        if (errors.length) {
          return res
            .status(400)
            .json({ message: `Invalid input: ${errors.join(', ')}` });
        }

        const validatedBody = body as PostgresMiningBody;
        const credentials = await resolvePostgresCredentials(
          user.id,
          validatedBody,
          miningSources
        );

        if (!credentials) {
          return res
            .status(404)
            .json({ message: 'PostgreSQL source not found' });
        }

        const queryService = queryServiceFactory(credentials);
        const preview: QueryPreviewResult = await queryService.previewQuery(
          validatedBody.query,
          5
        );

        return res.status(200).json(preview);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('PostgreSQL query preview failed', {
          error: err instanceof Error ? err.message : String(err)
        });
        return res
          .status(500)
          .json({ message: 'Unable to preview PostgreSQL query' });
      }
    },

    async listTables(req: Request, res: Response) {
      try {
        const { body } = req;

        if (!body.connection) {
          return res.status(400).json({ message: 'connection is required' });
        }

        const errors = validatePostgresConnectionBody(body.connection);
        if (errors.length) {
          return res
            .status(400)
            .json({ message: `Invalid connection: ${errors.join(', ')}` });
        }

        const credentials: PostgreSQLMiningSourceCredentials = {
          host: body.connection.host,
          port: body.connection.port,
          database: body.connection.database,
          username: body.connection.username,
          password: body.connection.password,
          ssl: body.connection.ssl ?? true
        };

        const queryService = queryServiceFactory(credentials);
        const tables = await queryService.listTables();

        return res.status(200).json({ tables });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('PostgreSQL list tables failed', {
          error: err instanceof Error ? err.message : String(err)
        });
        return res
          .status(500)
          .json({ message: 'Unable to list PostgreSQL tables' });
      }
    },

    async startMining(req: Request, res: Response) {
      const user = res.locals.user as User;
      const {
        params: { userId },
        body
      } = req;

      if (user.id !== userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      try {
        const errors = validatePostgresMiningBody(body);
        if (errors.length) {
          return res
            .status(400)
            .json({ message: `Invalid input: ${errors.join(', ')}` });
        }

        const validatedBody = body as PostgresMiningBody;
        const credentials = await resolvePostgresCredentials(
          user.id,
          validatedBody,
          miningSources
        );

        if (!credentials) {
          return res
            .status(404)
            .json({ message: 'PostgreSQL source not found' });
        }

        const queryService = queryServiceFactory(credentials);
        const totalRows = await queryService.countRows(validatedBody.query);

        const sourceName = validatedBody.sourceId ?? credentials.database;

        const miningTask = await tasksManagerPostgreSQL.createTask(
          user.id,
          sourceName,
          totalRows
        );

        const importMessage: EmailMessageData = {
          type: 'postgresql',
          miningId: miningTask.miningId,
          userIdentifier: user.id,
          userId: user.id,
          userEmail: user.email ?? '',
          data: {
            query: validatedBody.query,
            mapping: validatedBody.mapping ?? {},
            credentials,
            sourceName
          }
        };

        const redisClient = redis.getClient();
        const streamName = `messages_stream-${miningTask.miningId}`;
        const producer = new RedisStreamProducer<EmailMessageData>(
          redisClient,
          streamName,
          logger
        );

        await producer.produce([importMessage]);

        logger.info('PostgreSQL import task started', {
          miningId: miningTask.miningId,
          userId: user.id,
          sourceName,
          totalRows
        });

        return res.status(201).json({
          error: null,
          data: miningTask
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('PostgreSQL import start failed', {
          userId,
          requesterId: user.id,
          error: err instanceof Error ? err.message : String(err)
        });
        return res
          .status(500)
          .json({ message: 'Unable to start PostgreSQL import' });
      }
    }
  };
}
