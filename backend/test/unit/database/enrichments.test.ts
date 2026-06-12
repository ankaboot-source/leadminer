import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TaskCategory, TaskStatus, TaskType } from '../../../src/db/types';

import Engagements from '../../../src/db/supabase/engagements';
import Enrichments from '../../../src/db/supabase/enrichments';
import SupabaseTasks from '../../../src/db/supabase/tasks';
import logger from '../../../src/utils/logger';
import supabaseClient from '../../../src/utils/supabase';

jest.mock('../../../src/config', () => ({
  LEADMINER_API_HOST: 'leadminer-test.io/api/enrich/webhook',
  LEADMINER_API_LOG_LEVEL: 'error',
  SUPABASE_PROJECT_URL: 'fake',
  SUPABASE_SECRET_PROJECT_TOKEN: 'fake'
}));

jest.mock('../../../src/utils/logger');

jest.mock('@supabase/supabase-js');

function mockSupabaseClient() {
  return {
    from: jest.fn().mockReturnThis(),
    schema: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    rpc: jest.fn(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn()
  };
}

jest.mock('../../../src/utils/supabase', () => mockSupabaseClient());

function mockEngagementsDB() {
  return {
    register: jest.fn()
  } as unknown as Engagements;
}

function mockTasksDB() {
  return {
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  } as unknown as SupabaseTasks;
}

describe('Enrichments Class', () => {
  const mockTasks = mockTasksDB();
  const mockEngagements = mockEngagementsDB();
  const mockClient = supabaseClient;
  const enrichments = new Enrichments(
    mockTasks,
    mockEngagements,
    mockClient,
    logger
  );

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore chainable behavior that clearAllMocks resets
    (mockClient.from as jest.Mock).mockReturnThis();
    (mockClient.schema as jest.Mock).mockReturnThis();
    (mockClient.select as jest.Mock).mockReturnThis();
    (mockClient.in as jest.Mock).mockReturnThis();
  });

  describe('createFromId', () => {
    it('should set the task by ID', async () => {
      const task = { id: 'task-id', userId: 'user-id', details: {} };
      (mockTasks.getById as jest.Mock).mockReturnValue(task);

      const result = await enrichments.createFromId('task-id');

      expect(mockTasks.getById).toHaveBeenCalledWith('task-id');
      expect(result).toBe(task);
    });
  });

  describe('create', () => {
    it('should create a new task', async () => {
      const task = { id: 'new-task-id', userId: 'user-id', details: {} };
      (mockTasks.create as jest.Mock).mockReturnValue(task);

      const result = await enrichments.create('user-id', 10, true);

      expect(mockTasks.create).toHaveBeenCalledWith({
        userId: 'user-id',
        status: TaskStatus.Running,
        type: TaskType.Enrich,
        category: TaskCategory.Enriching,
        details: {
          result: [],
          total_enriched: 0,
          total_to_enrich: 10,
          update_empty_fields_only: true
        }
      });
      expect(result).toBe(task);
    });
  });

  describe('updateContacts', () => {
    it('should update contacts in the database', async () => {
      await enrichments.create('user-id', 10, true);
      const contacts = [
        {
          id: 'person-id-1',
          image: 'https://example.com/image.jpg',
          email: 'johndoe@example.com',
          name: 'John Doe',
          jobTitle: 'Software Engineer',
          givenName: 'John',
          familyName: 'Doe',
          organization: 'TechCorp Inc.',
          sameAs: [
            'https://linkedin.com/in/johndoe',
            'https://github.com/johndoe'
          ],
          location: 'San Francisco, CA, USA',
          alternateName: ['Johnny', 'J.D.']
        }
      ];

      const rpcMock = jest
        .fn()
        .mockReturnValue({ error: null, data: [{ id: 'person-id-1' }] });
      (mockClient.schema as jest.Mock).mockReturnValue({ rpc: rpcMock });

      const result = await enrichments.updateContacts(contacts);

      expect(result).toEqual(['person-id-1']);
      expect(rpcMock).toHaveBeenCalledWith('enrich_contacts', {
        p_contacts_data: [
          {
            id: 'person-id-1',
            user_id: 'user-id',
            email: 'johndoe@example.com',
            name: 'John Doe',
            job_title: 'Software Engineer',
            given_name: 'John',
            family_name: 'Doe',
            works_for: 'TechCorp Inc.',
            alternate_name: 'Johnny,J.D.',
            image: 'https://example.com/image.jpg',
            same_as:
              'https://linkedin.com/in/johndoe,https://github.com/johndoe',
            location: 'San Francisco, CA, USA'
          }
        ],
        p_update_empty_fields_only: true
      });
    });
  });

  describe('end', () => {
    it('should set the task status to Done', async () => {
      await enrichments.create('user-id', 10, true);
      await enrichments.end();
      const taskStatus = enrichments.redactedTask().status;
      expect(taskStatus).toEqual(TaskStatus.Done);
    });
  });

  describe('cancel', () => {
    it('should set the task status to Canceled', async () => {
      await enrichments.create('user-id', 10, true);
      await enrichments.cancel();
      const taskStatus = enrichments.redactedTask().status;
      expect(taskStatus).toEqual(TaskStatus.Canceled);
    });
  });

  describe('enrich', () => {
    it('should process enrichment results and update task details', async () => {
      const userId = 'user-id';
      const totalEnriched = 1;
      const totalToEnrich = 10;
      const updateEmptyFieldsOnly = true;
      const enrichmentResults = [
        {
          engine: 'test',
          data: [
            {
              person_id: 'person-id-1',
              email: 'test@example.com',
              name: 'hello'
            }
          ],
          raw_data: []
        }
      ];

      (mockTasks.create as jest.Mock).mockReturnValue({
        userId,
        status: TaskStatus.Running,
        type: TaskType.Enrich,
        category: TaskCategory.Enriching,
        details: {
          result: [],
          total_enriched: 0,
          total_to_enrich: totalToEnrich,
          update_empty_fields_only: updateEmptyFieldsOnly
        }
      });

      await enrichments.create(userId, totalToEnrich, updateEmptyFieldsOnly);

      const updateContactsSpy = jest
        .spyOn(enrichments, 'updateContacts')
        .mockResolvedValue(['person-id-1']);

      await enrichments.enrich(enrichmentResults);

      expect(mockTasks.update).toHaveBeenCalledTimes(1);
      expect(mockTasks.update).toHaveBeenCalledWith({
        userId,
        status: TaskStatus.Running,
        type: TaskType.Enrich,
        category: TaskCategory.Enriching,
        details: {
          result: enrichmentResults,
          total_enriched: totalEnriched,
          total_to_enrich: totalToEnrich,
          update_empty_fields_only: updateEmptyFieldsOnly
        }
      });
      expect(updateContactsSpy).toHaveBeenCalledWith([
        {
          person_id: 'person-id-1',
          email: 'test@example.com',
          name: 'hello'
        }
      ]);
      expect(mockEngagements.register).toHaveBeenCalledWith([
        {
          person_id: 'person-id-1',
          engagement_type: 'ENRICH',
          service: 'test',
          user_id: 'user-id'
        }
      ]);
    });
  });
});
