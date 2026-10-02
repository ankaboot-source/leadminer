import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Request, Response } from 'express';
import initializeContactsController from '../../../src/controllers/contacts.controller';
import type { Contacts } from '../../../src/db/interfaces/Contacts';
import type { MiningSources } from '../../../src/db/interfaces/MiningSources';
import type { Contact } from '../../../src/db/types';

const validateCustomerCredits = jest.fn();
const deductCustomerCredits = jest.fn();

jest.mock('../../../src/utils/billing-plugin', () => ({
  __esModule: true,
  default: {
    validateCustomerCredits: (...args: unknown[]) =>
      validateCustomerCredits(...args),
    deductCustomerCredits: (...args: unknown[]) =>
      deductCustomerCredits(...args)
  }
}));

const exportMock = jest.fn();

jest.mock('../../../src/services/export', () => ({
  __esModule: true,
  default: {
    get: () => ({
      export: (...args: unknown[]) => exportMock(...args)
    })
  }
}));

const USER_ID = 'user-1';

function makeContact(id: string): Contact {
  return { id, email: `${id}@example.com` } as Contact;
}

function createResponse() {
  const res = {
    locals: { user: { id: USER_ID, email: 'user@example.com' } },
    header: jest.fn(() => res),
    status: jest.fn(() => res),
    send: jest.fn(() => res),
    json: jest.fn(() => res),
    sendStatus: jest.fn(() => res)
  };
  return res as unknown as Response & typeof res;
}

function createRequest(partialExport = true): Request {
  return {
    params: { exportType: 'csv' },
    query: {},
    headers: {},
    body: { ids: ['a', 'b', 'c'], partialExport }
  } as unknown as Request;
}

type FakeContactSets = {
  activated: Contact[];
  notActivated: Contact[];
};

/**
 * The controller reads three things from the contacts store: the activated set
 * (already engaged) and the not-activated set (no engagement row).
 * and the selected contacts for the file.
 */
function createContacts(
  { activated, notActivated }: FakeContactSets,
  registerExportedContacts: jest.Mock
): Contacts {
  return {
    getActivatedContacts: jest.fn(async () => activated),
    getNonExportedContacts: jest.fn(async () => notActivated),
    getExportedContacts: jest.fn(async () => []),
    getContacts: jest.fn(async () => [...activated, ...notActivated]),
    registerExportedContacts
  } as unknown as Contacts;
}

const noSources = {} as MiningSources;

describe('contact export split on engagement presence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    exportMock.mockResolvedValue({ content: 'csv', contentType: 'text/csv' });
    validateCustomerCredits.mockResolvedValue({
      hasDeficientCredits: false,
      hasInsufficientCredits: false,
      requestedUnits: 0,
      availableUnits: 0
    });
  });

  function exportWith(
    sets: FakeContactSets,
    availableUnits: number,
    partialExport = true
  ) {
    const registerExportedContacts = jest.fn(async () => undefined);
    const controller = initializeContactsController(
      createContacts(sets, registerExportedContacts),
      noSources
    );
    const res = createResponse();

    validateCustomerCredits.mockResolvedValue({
      hasDeficientCredits: availableUnits === 0,
      hasInsufficientCredits: availableUnits < sets.notActivated.length,
      requestedUnits: sets.notActivated.length,
      availableUnits
    });

    return {
      controller,
      registerExportedContacts,
      result: controller.exportContactsCSV(
        createRequest(partialExport),
        res,
        jest.fn()
      )
    };
  }

  it('counts only the contacts with no engagement row as units', async () => {
    const activated = [makeContact('a')];
    const notActivated = [makeContact('b'), makeContact('c')];

    const { result } = exportWith({ activated, notActivated }, 2);
    await result;

    expect(validateCustomerCredits).toHaveBeenCalledWith(USER_ID, 2);
    expect(deductCustomerCredits).toHaveBeenCalledWith(USER_ID, 2);
  });

  it('adds no unit for an activated contact', async () => {
    const activated = [makeContact('a'), makeContact('b')];
    const notActivated = [makeContact('c')];

    const { result } = exportWith({ activated, notActivated }, 1);
    await result;

    // Only 'c' is a unit; the two activated contacts add nothing.
    expect(validateCustomerCredits).toHaveBeenCalledWith(USER_ID, 1);
  });

  it('writes every selected contact to the file, activated ones included', async () => {
    const activated = [makeContact('a')];
    const notActivated = [makeContact('b'), makeContact('c')];

    const { controller, result } = exportWith({ activated, notActivated }, 2);
    await result;

    const [fileContacts] = exportMock.mock.calls[0] as [Contact[]];
    expect(fileContacts.map((contact) => contact.id).sort()).toEqual([
      'a',
      'b',
      'c'
    ]);
    expect(controller).toBeDefined();
  });

  it('registers the whole file so an activated contact also gets an EXPORT row', async () => {
    const activated = [makeContact('a')];
    const notActivated = [makeContact('b')];

    const { registerExportedContacts, result } = exportWith(
      { activated, notActivated },
      1
    );
    await result;

    expect(registerExportedContacts).toHaveBeenCalledTimes(1);
    expect(registerExportedContacts.mock.calls[0][0].sort()).toEqual([
      'a',
      'b'
    ]);
  });

  it('keeps activated contacts when units run out and trims the rest', async () => {
    const activated = [makeContact('a')];
    const notActivated = [makeContact('b'), makeContact('c')];

    // Only one of the two not-activated contacts can be covered.
    const { result } = exportWith({ activated, notActivated }, 1);
    await result;

    const [fileContacts] = exportMock.mock.calls[0] as [Contact[]];
    expect(fileContacts.map((contact) => contact.id).sort()).toEqual([
      'a',
      'b'
    ]);
  });

  it('answers 402 when nothing is activated and there are no units left', async () => {
    const activated = [makeContact('a')];
    const notActivated = [makeContact('b')];

    // Credit is deficient but one contact is already activated, so the export
    // still happens with the activated contact only.
    const { result } = exportWith({ activated, notActivated }, 0);
    await result;

    const [fileContacts] = exportMock.mock.calls[0] as [Contact[]];
    expect(fileContacts.map((contact) => contact.id)).toEqual(['a']);
    expect(deductCustomerCredits).toHaveBeenCalledWith(USER_ID, 0);
  });
});
