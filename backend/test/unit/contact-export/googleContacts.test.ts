import { google, people_v1 } from 'googleapis';
import { GaxiosResponse } from 'gaxios';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { AxiosError } from 'axios';
import { ContactFrontend } from '../../../src/db/types';
import GoogleContactsSession from '../../../src/services/export/exports/google/contacts-api';
import GoogleContactsExport from '../../../src/services/export/exports/google';
import { ExportOptions } from '../../../src/services/export/types';
import logger from '../../../src/utils/logger';

// Mock Config & Logger
jest.mock('../../../src/config', () => ({
  APP_NAME: 'leadminer-test',
  GOOGLE_CONTACTS_READ_REQUESTS: 1000,
  GOOGLE_CONTACTS_WRITE_REQUESTS: 1000,
  GOOGLE_CONTACTS_CRITICAL_READ_REQUESTS: 1000,
  GOOGLE_CONTACTS_CRITICAL_WRITE_REQUESTS: 1000,

  GOOGLE_CONTACTS_READ_INTERVAL: 60,
  GOOGLE_CONTACTS_WRITE_INTERVAL: 60,
  GOOGLE_CONTACTS_CRITICAL_READ_INTERVAL: 60,
  GOOGLE_CONTACTS_CRITICAL_WRITE_INTERVAL: 60
}));
jest.mock('ioredis');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/redis');

jest.mock('googleapis', () => ({
  google: {
    people: jest.fn(),
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        credentials: {}
      }))
    }
  }
}));

type SearchContactsFn = (
  params: people_v1.Params$Resource$People$Searchcontacts
) => Promise<GaxiosResponse<people_v1.Schema$SearchResponse>>;

type ConnectionsListFn = (
  params: people_v1.Params$Resource$People$Connections$List
) => Promise<GaxiosResponse<people_v1.Schema$ListConnectionsResponse>>;

type BatchCreateFn = (
  params: people_v1.Params$Resource$People$Batchcreatecontacts
) => Promise<GaxiosResponse<people_v1.Schema$BatchCreateContactsResponse>>;

type BatchUpdateFn = (
  params: people_v1.Params$Resource$People$Batchupdatecontacts
) => Promise<GaxiosResponse<people_v1.Schema$BatchUpdateContactsResponse>>;

type ContactGroupsListFn = (
  params: people_v1.Params$Resource$Contactgroups$List
) => Promise<GaxiosResponse<people_v1.Schema$ListContactGroupsResponse>>;

type ContactGroupsCreateFn = (
  params: people_v1.Params$Resource$Contactgroups$Create
) => Promise<GaxiosResponse<people_v1.Schema$ContactGroup>>;

interface MockedPeopleService {
  people: {
    searchContacts?: jest.MockedFunction<SearchContactsFn>;
    connections: {
      list: jest.MockedFunction<ConnectionsListFn>;
    };
    batchCreateContacts: jest.MockedFunction<BatchCreateFn>;
    batchUpdateContacts: jest.MockedFunction<BatchUpdateFn>;
  };
  contactGroups: {
    list: jest.MockedFunction<ContactGroupsListFn>;
    create: jest.MockedFunction<ContactGroupsCreateFn>;
  };
}

describe('GoogleContactsExport', () => {
  let exporter: GoogleContactsExport;
  let mockService: MockedPeopleService;

  const mockOptions: ExportOptions = {
    googleContactsOptions: {
      userId: 'user-123',
      accessToken: 'valid_token',
      refreshToken: 'valid_refresh',
      updateEmptyFieldsOnly: false
    }
  };

  function createMockRes<T>(data: T): GaxiosResponse<T> {
    const response = {
      data,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      config: {
        url: 'https://mock.api',
        method: 'GET'
      }
    };

    return response as unknown as GaxiosResponse<T>;
  }

  function createMockContact(
    overrides: Partial<ContactFrontend> = {}
  ): ContactFrontend {
    return {
      id: '1',
      user_id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      ...overrides
    } as ContactFrontend;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    // Create properly typed mock functions
    const searchContactsMock = jest
      .fn<SearchContactsFn>()
      .mockResolvedValue(createMockRes({ results: [] }));

    const connectionsListMock = jest
      .fn<ConnectionsListFn>()
      .mockResolvedValue(createMockRes({ connections: [] }));

    const batchCreateMock = jest
      .fn<BatchCreateFn>()
      .mockResolvedValue(createMockRes({}));

    const batchUpdateMock = jest
      .fn<BatchUpdateFn>()
      .mockResolvedValue(createMockRes({}));

    const groupsListMock = jest
      .fn<ContactGroupsListFn>()
      .mockResolvedValue(createMockRes({ contactGroups: [] }));

    const groupsCreateMock = jest
      .fn<ContactGroupsCreateFn>()
      .mockResolvedValue(createMockRes({ resourceName: 'groups/new_id' }));

    mockService = {
      people: {
        searchContacts: searchContactsMock,
        connections: {
          list: connectionsListMock
        },
        batchCreateContacts: batchCreateMock,
        batchUpdateContacts: batchUpdateMock
      },
      contactGroups: {
        list: groupsListMock,
        create: groupsCreateMock
      }
    };

    const mockGooglePeople = google.people as jest.MockedFunction<
      typeof google.people
    >;
    mockGooglePeople.mockReturnValue(
      mockService as unknown as people_v1.People
    );

    exporter = new GoogleContactsExport();
  });

  it('should initialize service and trigger warmup exactly once', async () => {
    await exporter.export([], mockOptions);

    expect(google.people).toHaveBeenCalledWith({
      version: 'v1',
      auth: expect.any(Object)
    });

    expect(mockService.people.searchContacts).toHaveBeenCalledWith(
      expect.objectContaining({ query: '' })
    );

    expect(mockService.people.connections.list).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceName: 'people/me',
        pageSize: 1
      })
    );
  });

  it('should reject with Error if accessToken is missing', async () => {
    const invalidOptions = {
      googleContactsOptions: {}
    } as ExportOptions;

    await expect(exporter.export([], invalidOptions)).rejects.toThrow(
      'Invalid credentials.'
    );
  });

  it('should throw and log error if the People Service initialization fails (e.g. 401)', async () => {
    const authError = new Error('Unauthorized') as AxiosError;
    authError.status = 401;

    (google.people as jest.Mock).mockImplementationOnce(() => {
      throw authError;
    });

    await expect(exporter.export([], mockOptions)).rejects.toThrow(
      'Unauthorized'
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Export error: Unauthorized'),
      expect.anything()
    );
  });

  it('should bubble up critical errors from the session run', async () => {
    const failingBatchCreate = jest
      .fn<BatchCreateFn>()
      .mockRejectedValue(new Error('Quota Exceeded'));

    const failingService: MockedPeopleService = {
      people: {
        searchContacts: jest
          .fn<SearchContactsFn>()
          .mockResolvedValue(createMockRes({ results: [] })),
        connections: {
          list: jest
            .fn<ConnectionsListFn>()
            .mockResolvedValue(createMockRes({ connections: [] }))
        },
        batchCreateContacts: failingBatchCreate,
        batchUpdateContacts: jest
          .fn<BatchUpdateFn>()
          .mockResolvedValue(createMockRes({}))
      },
      contactGroups: {
        list: jest
          .fn<ContactGroupsListFn>()
          .mockResolvedValue(createMockRes({ contactGroups: [] })),
        create: jest
          .fn<ContactGroupsCreateFn>()
          .mockResolvedValue(createMockRes({ resourceName: 'groups/1' }))
      }
    };

    (google.people as jest.Mock).mockReturnValue(
      failingService as unknown as people_v1.People
    );

    const instance = new GoogleContactsExport();
    const contact = createMockContact({ email: 'test@test.com' });
    const options: ExportOptions = {
      googleContactsOptions: {
        userId: 'user-123',
        accessToken: 'fake_token',
        updateEmptyFieldsOnly: false
      }
    };

    await expect(instance.export([contact], options)).rejects.toThrow(
      'Quota Exceeded'
    );

    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('Error during sync:'),
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('Export error:'),
      expect.any(Error)
    );
  });

  it('should successfully export contacts when service is working', async () => {
    const contacts = [
      createMockContact({ email: 'user1@test.com' }),
      createMockContact({ email: 'user2@test.com' })
    ];

    await exporter.export(contacts, mockOptions);

    expect(mockService.people.batchCreateContacts).toHaveBeenCalled();

    const callArgs = mockService.people.batchCreateContacts.mock.calls[0];
    if (callArgs) {
      const contactsCreated = callArgs[0].requestBody?.contacts;
      expect(contactsCreated).toHaveLength(2);
    }
  });

  it('should handle empty contacts array gracefully', async () => {
    await exporter.export([], mockOptions);
    expect(google.people).toHaveBeenCalled();
    expect(mockService.people.batchCreateContacts).not.toHaveBeenCalled();
  });

  it('should pass updateEmptyFieldsOnly flag to session', async () => {
    const optionsWithUpdate: ExportOptions = {
      googleContactsOptions: {
        userId: 'user-123',
        accessToken: 'valid_token',
        refreshToken: 'valid_refresh',
        updateEmptyFieldsOnly: true
      }
    };

    mockService.people.connections.list.mockResolvedValue(
      createMockRes({
        connections: [
          {
            resourceName: 'people/c1',
            etag: 'etag-1',
            emailAddresses: [{ value: 'test@example.com' }],
            metadata: { sources: [{ type: 'CONTACT' }] }
          }
        ]
      })
    );

    const contact = createMockContact({ email: 'test@example.com' });
    await exporter.export([contact], optionsWithUpdate);
    expect(mockService.people.batchUpdateContacts).toHaveBeenCalled();
  });

  it('should handle network errors gracefully', async () => {
    const networkError = new Error('Network timeout');

    mockService.people.searchContacts?.mockRejectedValue(networkError);

    await expect(exporter.export([], mockOptions)).rejects.toThrow(
      'Network timeout'
    );

    expect(logger.error).toHaveBeenCalled();
  });
});

describe('GoogleContactsSession', () => {
  let mockService: MockedPeopleService;
  let session: GoogleContactsSession;
  const APP_NAME = 'leadminer-test';
  const USER_ID = 'user_123';

  function createMockRes<T>(data: T): GaxiosResponse<T> {
    const response = {
      data,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      config: {
        url: 'https://mock.api',
        method: 'GET'
      }
    };

    return response as unknown as GaxiosResponse<T>;
  }

  function createMockContact(
    overrides: Partial<ContactFrontend> = {}
  ): ContactFrontend {
    return {
      id: '1',
      user_id: USER_ID,
      email: 'john@doe.com',
      name: 'John Doe',
      given_name: 'John',
      family_name: 'Doe',
      tags: ['Tech'],
      telephone: ['123456789'],
      ...overrides
    };
  }

  function createMockPerson(
    resourceName: string,
    email: string
  ): people_v1.Schema$Person {
    return {
      resourceName,
      etag: `etag-${resourceName}`,
      metadata: { sources: [{ type: 'CONTACT' }] },
      emailAddresses: [{ value: email }],
      names: [{ givenName: 'Existing', familyName: 'Person' }]
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    const listMock = jest
      .fn<ConnectionsListFn>()
      .mockResolvedValue(createMockRes({ connections: [] }));

    const batchCreateMock = jest
      .fn<BatchCreateFn>()
      .mockResolvedValue(createMockRes({}));

    const batchUpdateMock = jest
      .fn<BatchUpdateFn>()
      .mockResolvedValue(createMockRes({}));

    const groupsListMock = jest
      .fn<ContactGroupsListFn>()
      .mockResolvedValue(createMockRes({ contactGroups: [] }));

    const groupsCreateMock = jest
      .fn<ContactGroupsCreateFn>()
      .mockResolvedValue(createMockRes({ resourceName: 'groups/new_id' }));

    mockService = {
      people: {
        connections: {
          list: listMock
        },
        batchCreateContacts: batchCreateMock,
        batchUpdateContacts: batchUpdateMock
      },
      contactGroups: {
        list: groupsListMock,
        create: groupsCreateMock
      }
    };
    session = new GoogleContactsSession(
      mockService as unknown as people_v1.People,
      APP_NAME,
      USER_ID
    );
  });

  describe('run() - Complete Flow', () => {
    it('should execute the complete sync flow in correct order', async () => {
      const existingGroup: people_v1.Schema$ContactGroup = {
        resourceName: 'groups/existing',
        name: 'ExistingTag'
      };

      mockService.contactGroups.list.mockResolvedValue(
        createMockRes({ contactGroups: [existingGroup] })
      );

      const contact = createMockContact({
        email: 'new@test.com',
        tags: ['NewTag']
      });

      await session.run([contact], false);

      const calls = [
        mockService.contactGroups.list.mock.invocationCallOrder[0],
        mockService.contactGroups.create.mock.invocationCallOrder[0],
        mockService.people.connections.list.mock.invocationCallOrder[0],
        mockService.people.batchCreateContacts.mock.invocationCallOrder[0]
      ];

      for (let i = 1; i < calls.length; i += 1) {
        expect(calls[i]).toBeGreaterThan(calls[i - 1]);
      }
    });

    it('should handle mixed create and update operations', async () => {
      const existingPerson = createMockPerson(
        'people/existing',
        'existing@test.com'
      );

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existingPerson] })
      );

      const contacts = [
        createMockContact({ email: 'existing@test.com' }),
        createMockContact({ email: 'new@test.com' })
      ];

      await session.run(contacts, false);

      expect(mockService.people.batchCreateContacts).toHaveBeenCalledTimes(1);
      expect(mockService.people.batchUpdateContacts).toHaveBeenCalledTimes(1);
    });

    it('should not create duplicate labels', async () => {
      const existingGroup: people_v1.Schema$ContactGroup = {
        resourceName: 'groups/tech',
        name: 'Tech'
      };

      mockService.contactGroups.list.mockResolvedValue(
        createMockRes({ contactGroups: [existingGroup] })
      );

      const contacts = [
        createMockContact({ tags: ['Tech'] }),
        createMockContact({ tags: ['Tech'] })
      ];

      await session.run(contacts, false);

      // Should only create APP_NAME label, not Tech (already exists)
      expect(mockService.contactGroups.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sync Logic (run)', () => {
    it('should create new contact when no match exists', async () => {
      const contact = createMockContact({ email: 'new@test.com' });

      await session.run([contact], false);

      expect(mockService.people.batchCreateContacts).toHaveBeenCalledTimes(1);

      const callArgs = mockService.people.batchCreateContacts.mock.calls[0];
      if (!callArgs) {
        throw new Error('Expected batchCreateContacts to be called');
      }

      const params = callArgs[0];
      const emailValue =
        params.requestBody?.contacts?.[0]?.contactPerson?.emailAddresses?.[0]
          ?.value;
      expect(emailValue).toBe('new@test.com');
    });

    it('should match and update existing contact by email', async () => {
      const existing = createMockPerson('people/c1', 'match@test.com');

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existing] })
      );

      const contact = createMockContact({
        email: 'match@test.com',
        given_name: 'UpdatedName'
      });

      await session.run([contact], false);

      expect(mockService.people.batchUpdateContacts).toHaveBeenCalledTimes(1);
    });

    it('should match by phone if email match fails', async () => {
      const existing: people_v1.Schema$Person = {
        ...createMockPerson('people/p1', 'other@test.com'),
        phoneNumbers: [{ value: '987654321' }]
      };

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existing] })
      );

      const contact = createMockContact({
        email: 'new@test.com',
        telephone: ['987654321']
      });

      await session.run([contact], false);

      expect(mockService.people.batchUpdateContacts).toHaveBeenCalledTimes(1);

      const callArgs = mockService.people.batchUpdateContacts.mock.calls[0];
      if (!callArgs) {
        throw new Error('Expected batchUpdateContacts to be called');
      }

      const params = callArgs[0];
      const contacts = params.requestBody?.contacts;
      expect(contacts).toBeDefined();
      expect(contacts?.['people/p1']).toBeDefined();
    });

    it('should handle labels (App Name + Tags) correctly', async () => {
      const contact = createMockContact({ tags: ['OpenSource', 'leads'] });

      await session.run([contact], false);

      expect(mockService.contactGroups.create).toHaveBeenCalledTimes(3);

      const labelsCreated = mockService.contactGroups.create.mock.calls.map(
        (call) => {
          const params = call[0];
          return params.requestBody?.contactGroup?.name;
        }
      );

      expect(labelsCreated).toContain(APP_NAME);
      expect(labelsCreated).toContain('OpenSource');
      expect(labelsCreated).toContain('leads');
    });

    it('should create new contact when multiple ambiguous matches exist', async () => {
      const person1 = createMockPerson('people/p1', 'test@test.com');
      const person2 = createMockPerson('people/p2', 'test@test.com');

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [person1, person2] })
      );

      const contact = createMockContact({ email: 'test@test.com' });

      await session.run([contact], false);

      // Should create instead of update when ambiguous
      expect(mockService.people.batchCreateContacts).toHaveBeenCalledTimes(1);
      expect(mockService.people.batchUpdateContacts).not.toHaveBeenCalled();
    });
  });

  describe('Update Modes (updateEmptyOnly)', () => {
    it('should not overwrite existing data when updateEmptyOnly is true', async () => {
      const existing: people_v1.Schema$Person = {
        ...createMockPerson('people/c1', 'test@test.com'),
        organizations: [{ name: 'Old Corp', title: 'CEO' }]
      };

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existing] })
      );

      const incoming = createMockContact({
        email: 'test@test.com',
        works_for: 'New Corp'
      });

      await session.run([incoming], true);

      const callArgs = mockService.people.batchUpdateContacts.mock.calls[0];
      if (!callArgs) {
        throw new Error('Expected batchUpdateContacts to be called');
      }

      const params = callArgs[0];
      const updatedContact = params.requestBody?.contacts?.['people/c1'];
      const orgName = updatedContact?.organizations?.[0]?.name;

      expect(orgName).toBe('Old Corp');
    });

    it('should overwrite existing data when updateEmptyOnly is false', async () => {
      const existing: people_v1.Schema$Person = {
        ...createMockPerson('people/c1', 'test@test.com'),
        organizations: [{ name: 'Old Corp', title: 'CEO' }]
      };

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existing] })
      );

      const incoming = createMockContact({
        email: 'test@test.com',
        works_for: 'New Corp'
      });

      await session.run([incoming], false);

      const callArgs = mockService.people.batchUpdateContacts.mock.calls[0];
      if (!callArgs) {
        throw new Error('Expected batchUpdateContacts to be called');
      }

      const params = callArgs[0];
      const updatedContact = params.requestBody?.contacts?.['people/c1'];
      const orgName = updatedContact?.organizations?.pop()?.name;

      expect(orgName).toBe('New Corp');
    });
  });

  describe('mapToPerson', () => {
    it('should map all contact fields correctly for new contact', async () => {
      const contact = createMockContact({
        email: 'test@example.com',
        name: 'John Doe',
        given_name: 'John',
        family_name: 'Doe',
        telephone: ['123456789', '987654321'],
        works_for: 'ACME Corp',
        job_title: 'Software Engineer',
        location: '123 Main St',
        same_as: ['https://linkedin.com/in/johndoe'],
        tags: ['VIP', 'Client']
      });

      await session.run([contact], false);

      const callArgs = mockService.people.batchCreateContacts.mock.calls[0];
      if (!callArgs) {
        throw new Error('Expected batchCreateContacts to be called');
      }

      const params = callArgs[0];
      const person = params.requestBody?.contacts?.[0]?.contactPerson;

      expect(person?.names?.[0]).toMatchObject({
        givenName: 'John',
        familyName: 'Doe',
        unstructuredName: 'John Doe'
      });
      expect(person?.emailAddresses?.[0]?.value).toBe('test@example.com');
      expect(person?.phoneNumbers).toHaveLength(2);
      expect(person?.organizations?.[0]).toMatchObject({
        name: 'ACME Corp',
        title: 'Software Engineer'
      });
      expect(person?.addresses?.[0]?.streetAddress).toBe('123 Main St');
      expect(person?.urls?.[0]?.value).toBe('https://linkedin.com/in/johndoe');
    });

    it('should preserve existing values and add new ones when updating', async () => {
      const existing: people_v1.Schema$Person = {
        ...createMockPerson('people/c1', 'old@test.com'),
        emailAddresses: [{ value: 'old@test.com' }],
        phoneNumbers: [{ value: '111111111' }]
      };

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existing] })
      );

      const incoming = createMockContact({
        email: 'old@test.com',
        telephone: ['222222222']
      });

      await session.run([incoming], false);

      const callArgs = mockService.people.batchUpdateContacts.mock.calls[0];
      if (!callArgs) {
        throw new Error('Expected batchUpdateContacts to be called');
      }

      const params = callArgs[0];
      const person = params.requestBody?.contacts?.['people/c1'];

      // Should have both old and new phone numbers
      expect(person?.phoneNumbers).toHaveLength(2);
      expect(person?.phoneNumbers?.some((p) => p.value === '111111111')).toBe(
        true
      );
      expect(person?.phoneNumbers?.some((p) => p.value === '222222222')).toBe(
        true
      );
    });

    it('should handle memberships and labels correctly', async () => {
      mockService.contactGroups.list.mockResolvedValue(
        createMockRes({
          contactGroups: [
            { resourceName: 'groups/app', name: APP_NAME },
            { resourceName: 'groups/vip', name: 'VIP' }
          ]
        })
      );

      const existing: people_v1.Schema$Person = {
        ...createMockPerson('people/c1', 'test@test.com'),
        memberships: [
          { contactGroupMembership: { contactGroupResourceName: 'groups/old' } }
        ]
      };

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existing] })
      );

      const contact = createMockContact({
        email: 'test@test.com',
        tags: ['VIP']
      });

      await session.run([contact], false);

      const callArgs = mockService.people.batchUpdateContacts.mock.calls[0];
      if (!callArgs) {
        throw new Error('Expected batchUpdateContacts to be called');
      }

      const params = callArgs[0];
      const person = params.requestBody?.contacts?.['people/c1'];

      expect(person?.memberships).toHaveLength(3); // old + app + VIP
      expect(
        person?.memberships?.some(
          (m) =>
            m.contactGroupMembership?.contactGroupResourceName === 'groups/app'
        )
      ).toBe(true);
      expect(
        person?.memberships?.some(
          (m) =>
            m.contactGroupMembership?.contactGroupResourceName === 'groups/vip'
        )
      ).toBe(true);
    });

    it('should deduplicate phone numbers correctly', async () => {
      const existing: people_v1.Schema$Person = {
        ...createMockPerson('people/c1', 'test@test.com'),
        phoneNumbers: [{ value: '123456789' }]
      };

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existing] })
      );

      const incoming = createMockContact({
        email: 'test@test.com',
        telephone: ['123456789']
      });

      await session.run([incoming], false);

      const callArgs = mockService.people.batchUpdateContacts.mock.calls[0];
      if (!callArgs) {
        throw new Error('Expected batchUpdateContacts to be called');
      }

      const params = callArgs[0];
      const person = params.requestBody?.contacts?.['people/c1'];

      // Should only have one phone number (deduplicated)
      expect(person?.phoneNumbers).toHaveLength(1);
      expect(person?.phoneNumbers?.[0]?.value).toBe('123456789');
    });

    it('should replace existing name when updating (singleton behavior)', async () => {
      const existing: people_v1.Schema$Person = {
        ...createMockPerson('people/c1', 'test@test.com'),
        names: [{
          givenName: 'Old',
          familyName: 'Name',
          unstructuredName: 'Old Name'
        }]
      };

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existing] })
      );

      const incoming = createMockContact({
        email: 'test@test.com',
        given_name: 'New',
        family_name: 'Name',
        name: 'New Name'
      });

      await session.run([incoming], false);

      const callArgs = mockService.people.batchUpdateContacts.mock.calls[0];
      if (!callArgs) {
        throw new Error('Expected batchUpdateContacts to be called');
      }

      const params = callArgs[0];
      const person = params.requestBody?.contacts?.['people/c1'];

      // Should have only ONE name (singleton), not append
      expect(person?.names).toHaveLength(1);
      expect(person?.names?.[0]).toMatchObject({
        givenName: 'New',
        familyName: 'Name',
        unstructuredName: 'New Name'
      });
    });

    it('should add phone numbers when updateEmptyOnly=true and no existing phones', async () => {
      const existing: people_v1.Schema$Person = {
        ...createMockPerson('people/c1', 'test@test.com'),
        phoneNumbers: []
      };

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existing] })
      );

      const incoming = createMockContact({
        email: 'test@test.com',
        telephone: ['123456789']
      });

      await session.run([incoming], true);

      const callArgs = mockService.people.batchUpdateContacts.mock.calls[0];
      if (!callArgs) {
        throw new Error('Expected batchUpdateContacts to be called');
      }

      const params = callArgs[0];
      const person = params.requestBody?.contacts?.['people/c1'];

      // Should add phone number even with updateEmptyOnly=true when no existing phones
      expect(person?.phoneNumbers).toHaveLength(1);
      expect(person?.phoneNumbers?.[0]?.value).toBe('123456789');
    });

    it('should not create name entry with only null values', async () => {
      const contact = createMockContact({
        email: 'test@example.com',
        name: null as unknown as undefined,
        given_name: null as unknown as undefined,
        family_name: null as unknown as undefined
      });

      await session.run([contact], false);

      const callArgs = mockService.people.batchCreateContacts.mock.calls[0];
      if (!callArgs) {
        throw new Error('Expected batchCreateContacts to be called');
      }

      const params = callArgs[0];
      const person = params.requestBody?.contacts?.[0]?.contactPerson;

      // Should not have names array if all name fields are null/empty
      expect(person?.names).toHaveLength(0);
    });

    it('should deduplicate URLs correctly', async () => {
      const existing: people_v1.Schema$Person = {
        ...createMockPerson('people/c1', 'test@test.com'),
        urls: [{ value: 'https://example.com' }]
      };

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existing] })
      );

      const incoming = createMockContact({
        email: 'test@test.com',
        same_as: ['https://example.com', 'https://newsite.com']
      });

      await session.run([incoming], false);

      const callArgs = mockService.people.batchUpdateContacts.mock.calls[0];
      if (!callArgs) {
        throw new Error('Expected batchUpdateContacts to be called');
      }

      const params = callArgs[0];
      const person = params.requestBody?.contacts?.['people/c1'];

      // Should have both URLs without duplication
      expect(person?.urls).toHaveLength(2);
      expect(person?.urls?.some((u) => u.value === 'https://example.com')).toBe(true);
      expect(person?.urls?.some((u) => u.value === 'https://newsite.com')).toBe(true);
    });

    it('should deduplicate organizations correctly', async () => {
      const existing: people_v1.Schema$Person = {
        ...createMockPerson('people/c1', 'test@test.com'),
        organizations: [{ name: 'ACME Corp', title: 'Engineer' }]
      };

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existing] })
      );

      const incoming = createMockContact({
        email: 'test@test.com',
        works_for: 'ACME Corp',
        job_title: 'Engineer'
      });

      await session.run([incoming], false);

      const callArgs = mockService.people.batchUpdateContacts.mock.calls[0];
      if (!callArgs) {
        throw new Error('Expected batchUpdateContacts to be called');
      }

      const params = callArgs[0];
      const person = params.requestBody?.contacts?.['people/c1'];

      // Should have only one organization (deduplicated)
      expect(person?.organizations).toHaveLength(1);
      expect(person?.organizations?.[0]).toMatchObject({
        name: 'ACME Corp',
        title: 'Engineer'
      });
    });
  });

  describe('System Safety & Pagination', () => {
    it('should handle large batches by chunking contacts into groups of 200', async () => {
      const manyContacts = Array.from({ length: 250 }, (_, i) =>
        createMockContact({ email: `test${i}@test.com` })
      );

      await session.run(manyContacts, false);

      expect(mockService.people.batchCreateContacts).toHaveBeenCalledTimes(2);

      // First batch should have 200 contacts
      const firstCall = mockService.people.batchCreateContacts.mock.calls[0];
      if (firstCall) {
        const firstBatchSize = firstCall[0].requestBody?.contacts?.length;
        expect(firstBatchSize).toBe(200);
      }

      // Second batch should have 50 contacts
      const secondCall = mockService.people.batchCreateContacts.mock.calls[1];
      if (secondCall) {
        const secondBatchSize = secondCall[0].requestBody?.contacts?.length;
        expect(secondBatchSize).toBe(50);
      }
    });

    it('should follow pagination for large contact lists', async () => {
      mockService.people.connections.list
        .mockResolvedValueOnce(
          createMockRes({
            connections: [createMockPerson('p1', '1@a.com')],
            nextPageToken: 'page2'
          })
        )
        .mockResolvedValueOnce(
          createMockRes({
            connections: [createMockPerson('p2', '2@a.com')]
          })
        );

      await session.run([createMockContact({ email: 'new@a.com' })], false);

      expect(mockService.people.connections.list).toHaveBeenCalledTimes(2);

      const secondCallArgs = mockService.people.connections.list.mock.calls[1];
      if (!secondCallArgs) {
        throw new Error('Expected second call to connections.list');
      }

      const params = secondCallArgs[0];
      expect(params.pageToken).toBe('page2');
    });

    it('should handle pagination with multiple pages', async () => {
      mockService.people.connections.list
        .mockResolvedValueOnce(
          createMockRes({
            connections: [createMockPerson('p1', '1@a.com')],
            nextPageToken: 'page2'
          })
        )
        .mockResolvedValueOnce(
          createMockRes({
            connections: [createMockPerson('p2', '2@a.com')],
            nextPageToken: 'page3'
          })
        )
        .mockResolvedValueOnce(
          createMockRes({
            connections: [createMockPerson('p3', '3@a.com')]
          })
        );

      await session.run([createMockContact({ email: 'new@a.com' })], false);

      expect(mockService.people.connections.list).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty contact list gracefully', async () => {
      await session.run([], false);

      expect(mockService.people.batchCreateContacts).not.toHaveBeenCalled();
      expect(mockService.people.batchUpdateContacts).not.toHaveBeenCalled();
    });

    it('should handle contacts without phone numbers', async () => {
      const contact = createMockContact({
        email: 'test@test.com',
        telephone: undefined
      });

      await session.run([contact], false);

      const callArgs = mockService.people.batchCreateContacts.mock.calls[0];
      if (callArgs) {
        const person = callArgs[0].requestBody?.contacts?.[0]?.contactPerson;
        expect(person?.phoneNumbers).toEqual([]);
      }
    });

    it('should handle contacts without tags', async () => {
      const contact = createMockContact({
        email: 'test@test.com',
        tags: undefined
      });

      await session.run([contact], false);

      // Should still create APP_NAME label
      expect(mockService.contactGroups.create).toHaveBeenCalledTimes(1);
    });

    it('should normalize phone numbers for matching (remove spaces)', async () => {
      const existing: people_v1.Schema$Person = {
        ...createMockPerson('people/p1', 'other@test.com'),
        phoneNumbers: [{ value: '123 456 789' }]
      };

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existing] })
      );

      const contact = createMockContact({
        email: 'new@test.com',
        telephone: ['123456789']
      });

      await session.run([contact], false);

      // Should match and update
      expect(mockService.people.batchUpdateContacts).toHaveBeenCalledTimes(1);
    });

    it('should handle case-insensitive email matching', async () => {
      const existing = createMockPerson('people/c1', 'Test@Example.COM');

      mockService.people.connections.list.mockResolvedValue(
        createMockRes({ connections: [existing] })
      );

      const contact = createMockContact({
        email: 'test@example.com' // Lowercase
      });

      await session.run([contact], false);

      // Should match and update (not create)
      expect(mockService.people.batchUpdateContacts).toHaveBeenCalledTimes(1);
      expect(mockService.people.batchCreateContacts).not.toHaveBeenCalled();
    });
  });
});
