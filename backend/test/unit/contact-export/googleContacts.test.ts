import { google, people_v1 } from 'googleapis';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { AxiosError } from 'axios';
import { ExportOptions } from '../../../src/services/export/types';
import { ContactFrontend } from '../../../src/db/types';
import logger from '../../../src/utils/logger';
import GoogleContactsExport from '../../../src/services/export/exports/google';
import GoogleContactsSession from '../../../src/services/export/exports/google/contacts-api';

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/config', () => ({}));
jest.mock('googleapis', () => {
  const mockSearch = jest.fn().mockReturnValue({ data: {} });
  const mockList = jest.fn().mockReturnValue({ data: {} });

  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          setCredentials: jest.fn()
        }))
      },
      people: jest.fn().mockReturnValue({
        people: {
          searchContacts: mockSearch,
          connections: { list: mockList }
        },
        contactGroups: {
          list: jest.fn().mockReturnValue({ data: { contactGroups: [] } }),
          create: jest
            .fn()
            .mockReturnValue({ data: { resourceName: 'contactGroups/new_id' } })
        }
      })
    }
  };
});

describe('GoogleContactsSession', () => {
  let mockService: jest.Mocked<people_v1.People>;
  let session: GoogleContactsSession;
  const APP_NAME = 'Leadminer';

  const mockContact: ContactFrontend = {
    id: '1',
    user_id: 'user_123',
    email: 'john@leadminer.io',
    name: 'John Doe',
    given_name: 'John',
    family_name: 'Doe',
    tags: ['Tech', 'Space'],
    telephone: ['+123456789']
  };

  beforeEach(() => {
    mockService = {
      people: {
        searchContacts: jest.fn(),
        createContact: jest.fn(),
        updateContact: jest.fn()
      },
      contactGroups: {
        list: jest.fn().mockReturnValue({ data: { contactGroups: [] } }),
        create: jest
          .fn()
          .mockReturnValue({ data: { resourceName: 'contactGroups/new_id' } })
      }
    } as unknown as jest.Mocked<people_v1.People>;

    session = new GoogleContactsSession(mockService, APP_NAME);
  });

  describe('run()', () => {
    it('should create a contact when search returns no results', async () => {
      (mockService.people.searchContacts as jest.Mock).mockReturnValue({
        data: { results: [] }
      });
      (mockService.people.createContact as jest.Mock).mockReturnValue({
        data: {}
      });

      await session.run([mockContact], false);

      expect(mockService.people.createContact).toHaveBeenCalledTimes(1);
      expect(mockService.people.updateContact).not.toHaveBeenCalled();
    });

    it('should update an existing contact and merge by resourceName', async () => {
      const existingPerson: people_v1.Schema$Person = {
        resourceName: 'people/c123',
        etag: 'v1',
        metadata: { sources: [{ type: 'CONTACT' }] },
        names: [{ givenName: 'John' }]
      };

      (mockService.people.searchContacts as jest.Mock).mockReturnValue({
        data: { results: [{ person: existingPerson }] }
      });

      await session.run([mockContact], false);

      expect(mockService.people.updateContact).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceName: 'people/c123',
          updatePersonFields: expect.stringContaining('names'),
          requestBody: expect.objectContaining({ etag: 'v1' })
        })
      );
    });

    it('should create labels that do not exist in the labelMap', async () => {
      (mockService.contactGroups.list as jest.Mock).mockReturnValue({
        data: { contactGroups: [] }
      });

      await session.run([mockContact], false);

      expect(mockService.contactGroups.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: { contactGroup: { name: APP_NAME } }
        })
      );
      expect(mockService.contactGroups.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: { contactGroup: { name: 'Tech' } }
        })
      );
    });

    it('should NOT update an existing field when updateEmptyOnly is true', async () => {
      const existingPerson: people_v1.Schema$Person = {
        resourceName: 'people/123',
        etag: 'etag_old',
        names: [{ givenName: 'John', familyName: 'OldName' }], // givenName exists!
        metadata: { sources: [{ type: 'CONTACT' }] }
      };

      (mockService.people.searchContacts as jest.Mock).mockReturnValue({
        data: { results: [{ person: existingPerson }] }
      });

      const contactUpdate: ContactFrontend = {
        email: 'john@leadminer.io',
        family_name: 'NewName'
      } as ContactFrontend;

      await session.run([contactUpdate], true);

      expect(mockService.people.updateContact).toHaveBeenCalledWith(
        expect.objectContaining({
          updatePersonFields: expect.not.stringContaining('names'),
          requestBody: expect.not.objectContaining({
            names: expect.anything()
          })
        })
      );
    });

    it('should update an empty field (familyName) even when updateEmptyOnly is true but givenName exists', async () => {
      const existingPerson: people_v1.Schema$Person = {
        resourceName: 'people/123',
        etag: 'etag_old',
        names: [{ givenName: 'John' }],
        metadata: { sources: [{ type: 'CONTACT' }] }
      };

      (mockService.people.searchContacts as jest.Mock).mockReturnValue({
        data: { results: [{ person: existingPerson }] }
      });

      const contactUpdate: ContactFrontend = {
        email: 'john@leadminer.io',
        given_name: 'John',
        family_name: 'Doe'
      } as ContactFrontend;

      await session.run([contactUpdate], true);

      expect(mockService.people.updateContact).toHaveBeenCalledWith(
        expect.objectContaining({
          updatePersonFields: expect.stringContaining('names'),
          requestBody: expect.objectContaining({
            names: [
              expect.objectContaining({
                givenName: 'John',
                familyName: 'Doe'
              })
            ]
          })
        })
      );
    });
  });
});

describe('GoogleContactsExport', () => {
  let exporter: GoogleContactsExport;
  const mockOptions: ExportOptions = {
    googleContactsOptions: {
      accessToken: 'valid_token',
      refreshToken: 'valid_refresh',
      updateEmptyFieldsOnly: false
    }
  };

  beforeEach(() => {
    exporter = new GoogleContactsExport();
    jest.clearAllMocks();
  });

  it('should initialize service and trigger warmup exactly once', async () => {
    await exporter.export([], mockOptions);

    const mockPeople = google.people({ version: 'v1' });

    expect(mockPeople.people.searchContacts).toHaveBeenCalledWith(
      expect.objectContaining({ query: '' })
    );
    expect(mockPeople.people.connections.list).toHaveBeenCalledWith(
      expect.objectContaining({ resourceName: 'people/me', pageSize: 1 })
    );
  });

  it('should reject with Error if accessToken is missing', async () => {
    const invalidOptions = { googleContactsOptions: {} } as ExportOptions;
    await expect(exporter.export([], invalidOptions)).rejects.toThrow(
      'Invalid credentials.'
    );
  });

  it('should throw and log error if the People Service initialization fails (e.g. 401)', async () => {
    const authError = new Error('Unauthorized');
    (authError as AxiosError).status = 401;
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
    const mockService = {
      people: {
        searchContacts: jest
          .fn()
          .mockImplementation(() => Promise.resolve({ data: { results: [] } })),
        createContact: jest
          .fn()
          .mockImplementation(() => Promise.reject(new Error('Quota Exceeded')))
      },
      contactGroups: {
        list: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve({ data: { contactGroups: [] } })
          ),
        create: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve({ data: { resourceName: 'groups/1' } })
          )
      },
      connections: {
        list: jest.fn().mockImplementation(() => Promise.resolve({ data: {} }))
      }
    } as unknown as jest.Mocked<people_v1.People>;

    interface MockableExporter {
      getPeopleService: (options: ExportOptions) => Promise<people_v1.People>;
    }

    jest
      .spyOn(
        GoogleContactsExport as unknown as MockableExporter,
        'getPeopleService'
      )
      .mockResolvedValue(mockService);

    const instance = new GoogleContactsExport();
    const contact = { email: 'test@test.com' } as ContactFrontend;
    const options = {
      googleContactsOptions: { accessToken: 'fake_token' }
    } as ExportOptions;

    await expect(instance.export([contact], options)).rejects.toThrow(
      'Quota Exceeded'
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error creating Google contact'),
      expect.objectContaining({ error: 'Quota Exceeded' })
    );
  });
});
