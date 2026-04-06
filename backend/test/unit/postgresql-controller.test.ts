import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { MiningSources } from '../../src/db/interfaces/MiningSources';
import initializePostgresqlController, {
  validatePostgresConnectionBody,
  validatePostgresMiningBody
} from '../../src/controllers/postgresql.controller';

jest.mock('../../src/utils/helpers/postgresConnection', () => ({
  testPostgresConnection: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../src/utils/redis', () => ({
  __esModule: true,
  default: {
    getClient: jest.fn(() => ({
      xadd: jest.fn(),
      pipeline: jest.fn(() => ({
        exec: jest.fn()
      }))
    }))
  }
}));

jest.mock('../../src/utils/streams/redis/RedisStreamProducer', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    produce: jest.fn().mockResolvedValue(undefined)
  }))
}));

const { testPostgresConnection } = jest.requireMock(
  '../../src/utils/helpers/postgresConnection'
) as {
  testPostgresConnection: jest.Mock;
};

function createTasksManagerMock() {
  return {
    createTask: jest.fn().mockResolvedValue({
      miningId: 'test-mining-id',
      userId: 'user-id',
      miningSource: { source: 'test-db', type: 'postgresql' },
      progress: {
        totalImported: 100,
        extracted: 0,
        verifiedContacts: 0,
        createdContacts: 0
      }
    }),
    getTaskOrThrow: jest.fn()
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

function createMiningSourcesMock(
  upsert = jest.fn().mockResolvedValue(undefined)
): MiningSources {
  return {
    upsert,
    getByUser: jest.fn().mockResolvedValue([]),
    getSourcesForUser: jest.fn().mockResolvedValue([])
  };
}

describe('postgresql controller validators', () => {
  describe('validatePostgresConnectionBody', () => {
    it('returns validation errors for non-object payload', () => {
      const errors = validatePostgresConnectionBody(null);

      expect(errors).toContain('Invalid input payload');
    });

    it('returns no errors for a valid connection payload', () => {
      const errors = validatePostgresConnectionBody({
        host: 'localhost',
        port: 5432,
        database: 'contacts',
        username: 'readonly_user',
        password: 'secret',
        ssl: true
      });

      expect(errors).toEqual([]);
    });

    it('requires non-empty host', () => {
      const errors = validatePostgresConnectionBody({
        host: '   ',
        port: 5432,
        database: 'contacts',
        username: 'readonly_user',
        password: 'secret'
      });

      expect(errors).toContain('host must be a non-empty string.');
    });

    it('requires connectionName when saveConnection is true', () => {
      const errors = validatePostgresConnectionBody({
        host: 'localhost',
        port: 5432,
        database: 'contacts',
        username: 'readonly_user',
        password: 'secret',
        saveConnection: true
      });

      expect(errors).toContain(
        'connectionName is required when saveConnection is enabled'
      );
    });

    it('requires boolean saveConnection when provided', () => {
      const errors = validatePostgresConnectionBody({
        host: 'localhost',
        port: 5432,
        database: 'contacts',
        username: 'readonly_user',
        password: 'secret',
        saveConnection: 'yes'
      });

      expect(errors).toContain('saveConnection must be a boolean');
    });

    it('requires valid port range', () => {
      const errors = validatePostgresConnectionBody({
        host: 'localhost',
        port: 70000,
        database: 'contacts',
        username: 'readonly_user',
        password: 'secret'
      });

      expect(errors).toContain('port must be an integer between 1 and 65535');
    });

    it('rejects port values less than 1', () => {
      const errors = validatePostgresConnectionBody({
        host: 'localhost',
        port: 0,
        database: 'contacts',
        username: 'readonly_user',
        password: 'secret'
      });

      expect(errors).toContain('port must be an integer between 1 and 65535');
    });
  });

  describe('validatePostgresMiningBody', () => {
    it('returns validation errors for non-object payload', () => {
      const errors = validatePostgresMiningBody(undefined);

      expect(errors).toContain('Invalid input payload');
    });

    it('returns query errors for forbidden SQL', () => {
      const errors = validatePostgresMiningBody({
        sourceId: 'saved-source',
        query: 'DELETE FROM contacts',
        mapping: {
          email_column: 'email'
        }
      });

      expect(errors).toContain('Only SELECT queries are allowed');
    });

    it('requires sourceId or connection object', () => {
      const errors = validatePostgresMiningBody({
        query: 'SELECT email FROM contacts',
        mapping: {
          email: 'email'
        }
      });

      expect(errors).toContain('Either sourceId or connection is required');
    });

    it('requires email mapping', () => {
      const errors = validatePostgresMiningBody({
        sourceId: 'saved-source',
        query: 'SELECT email, full_name FROM contacts',
        mapping: {
          full_name: 'name'
        }
      });

      expect(errors).toContain('Email mapping is required');
    });

    it('returns no errors for valid payload', () => {
      const errors = validatePostgresMiningBody({
        sourceId: 'saved-source',
        query: 'SELECT email, full_name FROM contacts',
        mapping: {
          email: 'email',
          full_name: 'name'
        }
      });

      expect(errors).toEqual([]);
    });
  });

  describe('controller handlers', () => {
    type MockRequest = Partial<Request>;

    const makeRes = () => {
      const res = {
        locals: { user: { id: 'user-id' } },
        status: jest.fn(),
        json: jest.fn()
      };

      res.status.mockReturnValue(res);
      return res as unknown as Response;
    };

    it('tests connection and saves source when requested', async () => {
      const upsert = jest.fn().mockResolvedValue(undefined);
      const controller = initializePostgresqlController(
        createMiningSourcesMock(upsert),
        createTasksManagerMock()
      );
      const req: MockRequest = {
        body: {
          host: 'localhost',
          port: 5432,
          database: 'contacts',
          username: 'readonly_user',
          password: 'secret',
          saveConnection: true,
          connectionName: 'My Source'
        }
      };
      const res = makeRes();

      testPostgresConnection.mockResolvedValue({ success: true });

      await controller.testConnection(req as Request, res);

      expect(testPostgresConnection).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        database: 'contacts',
        username: 'readonly_user',
        password: 'secret',
        ssl: true
      });
      expect(upsert).toHaveBeenCalledWith({
        userId: 'user-id',
        email: 'My Source',
        type: 'postgresql',
        credentials: {
          host: 'localhost',
          port: 5432,
          database: 'contacts',
          username: 'readonly_user',
          password: 'secret',
          ssl: true
        }
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, saved: true });
    });

    it('returns 400 when postgres connection test fails', async () => {
      const upsert = jest.fn().mockResolvedValue(undefined);
      const controller = initializePostgresqlController(
        createMiningSourcesMock(upsert),
        createTasksManagerMock()
      );
      const req: MockRequest = {
        body: {
          host: 'localhost',
          port: 5432,
          database: 'contacts',
          username: 'readonly_user',
          password: 'secret'
        }
      };
      const res = makeRes();

      testPostgresConnection.mockResolvedValue({
        success: false,
        error: 'Authentication failed'
      });

      await controller.testConnection(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authentication failed'
      });
      expect(upsert).not.toHaveBeenCalled();
    });

    it('does not save source when saveConnection is false', async () => {
      const upsert = jest.fn().mockResolvedValue(undefined);
      const controller = initializePostgresqlController(
        createMiningSourcesMock(upsert),
        createTasksManagerMock()
      );
      const req: MockRequest = {
        body: {
          host: 'localhost',
          port: 5432,
          database: 'contacts',
          username: 'readonly_user',
          password: 'secret',
          saveConnection: false
        }
      };
      const res = makeRes();

      testPostgresConnection.mockResolvedValue({ success: true });

      await controller.testConnection(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, saved: false });
      expect(upsert).not.toHaveBeenCalled();
    });

    it('returns 500 when connection test throws unexpectedly', async () => {
      const controller = initializePostgresqlController(
        createMiningSourcesMock(),
        createTasksManagerMock()
      );
      const req: MockRequest = {
        body: {
          host: 'localhost',
          port: 5432,
          database: 'contacts',
          username: 'readonly_user',
          password: 'secret'
        }
      };
      const res = makeRes();

      testPostgresConnection.mockRejectedValue(new Error('boom'));

      await controller.testConnection(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Unable to test PostgreSQL connection'
      });
    });

    it('returns 400 on invalid preview payload', async () => {
      const controller = initializePostgresqlController(
        createMiningSourcesMock(),
        createTasksManagerMock()
      );
      const req: MockRequest = {
        body: {
          sourceId: 'source-id',
          mapping: {
            col: 'not_a_contact_field'
          }
        }
      };
      const res = makeRes();

      await controller.previewQuery(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when sourceId does not exist for preview', async () => {
      const miningSources = createMiningSourcesMock();
      const controller = initializePostgresqlController(
        miningSources,
        createTasksManagerMock()
      );
      const req: MockRequest = {
        body: {
          sourceId: 'missing-source',
          query: 'SELECT email FROM contacts',
          mapping: { email: 'email' }
        }
      };
      const res = makeRes();

      await controller.previewQuery(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'PostgreSQL source not found'
      });
    });

    it('returns query preview rows for valid payload', async () => {
      const previewQuery = jest.fn().mockResolvedValue({
        rows: [{ email: 'a@test.com' }],
        columns: ['email'],
        totalCount: 1
      });
      const countRows = jest.fn().mockResolvedValue(100);
      const queryServiceFactory = jest.fn(() => ({ previewQuery, countRows }));
      const controller = initializePostgresqlController(
        createMiningSourcesMock(),
        createTasksManagerMock(),
        queryServiceFactory
      );
      const req: MockRequest = {
        body: {
          query: 'SELECT email FROM contacts',
          mapping: { email: 'email' },
          connection: {
            host: 'localhost',
            port: 5432,
            database: 'contacts',
            username: 'readonly_user',
            password: 'secret'
          }
        }
      };
      const res = makeRes();

      await controller.previewQuery(req as Request, res);

      expect(queryServiceFactory).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        database: 'contacts',
        username: 'readonly_user',
        password: 'secret',
        ssl: true
      });
      expect(previewQuery).toHaveBeenCalledWith(
        'SELECT email FROM contacts',
        5
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        rows: [{ email: 'a@test.com' }],
        columns: ['email'],
        totalCount: 1
      });
    });

    it('returns 201 for valid startMining payload', async () => {
      const countRows = jest.fn().mockResolvedValue(100);
      const queryServiceFactory = jest.fn(() => ({ countRows }));
      const tasksManager = createTasksManagerMock();
      const controller = initializePostgresqlController(
        createMiningSourcesMock(),
        tasksManager,
        queryServiceFactory
      );
      const req: MockRequest = {
        params: { userId: 'user-id' },
        body: {
          query: 'SELECT email FROM contacts',
          mapping: { email: 'email' },
          connection: {
            host: 'localhost',
            port: 5432,
            database: 'contacts',
            username: 'readonly_user',
            password: 'secret'
          }
        }
      };
      const res = makeRes();

      await controller.startMining(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(tasksManager.createTask).toHaveBeenCalledWith(
        'user-id',
        'contacts',
        100
      );
    });

    it('returns 400 for invalid startMining payload', async () => {
      const controller = initializePostgresqlController(
        createMiningSourcesMock(),
        createTasksManagerMock()
      );
      const req: MockRequest = {
        params: { userId: 'user-id' },
        body: {
          sourceId: 'source-id',
          query: 'SELECT email FROM contacts',
          mapping: { name_col: 'name' }
        }
      };
      const res = makeRes();

      await controller.startMining(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects unauthorized startMining', async () => {
      const controller = initializePostgresqlController(
        createMiningSourcesMock(),
        createTasksManagerMock()
      );
      const req: MockRequest = {
        params: { userId: 'other-user' },
        body: {
          sourceId: 'source-id',
          query: 'SELECT email FROM contacts',
          mapping: { email: 'email' }
        }
      };
      const res = makeRes();

      await controller.startMining(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });

    it('returns 500 when previewQuery body throws', async () => {
      const controller = initializePostgresqlController(
        createMiningSourcesMock(),
        createTasksManagerMock()
      );
      const req = {
        get body() {
          throw new Error('bad-body');
        }
      } as Partial<Request>;
      const res = makeRes();

      await controller.previewQuery(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Unable to preview PostgreSQL query'
      });
    });
  });
});
