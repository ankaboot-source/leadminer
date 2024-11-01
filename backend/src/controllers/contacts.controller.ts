import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import { Contacts } from '../db/interfaces/Contacts';
import { Contact } from '../db/types';
import {
  exportContactsToCSV,
  getLocalizedCsvSeparator
} from '../utils/helpers/csv';
import Billing from '../utils/billing-plugin';

function validateRequest(req: Request, res: Response) {
  const userId = (res.locals.user as User).id;
  const partialExport = req.body.partialExport ?? false;
  const {
    emails,
    exportAllContacts
  }: { emails?: string[]; exportAllContacts: boolean } = req.body;

  if (!exportAllContacts && (!Array.isArray(emails) || !emails.length)) {
    return {
      userId,
      contactsToExport: null,
      partialExport,
      delimiter: undefined
    };
  }

  const contactsToExport = exportAllContacts ? undefined : emails;
  const localeFromHeader = req.headers['accept-language'];
  const delimiterOption = req.query.delimiter?.toString();
  const delimiter =
    delimiterOption ?? getLocalizedCsvSeparator(localeFromHeader);

  return {
    userId,
    contactsToExport,
    partialExport,
    delimiter
  };
}

async function respondWithContacts(
  res: Response,
  userId: string,
  contacts: Contacts,
  contactsToExport?: string[],
  delimiter?: string
) {
  const selectedContacts = await contacts.getContacts(userId, contactsToExport);

  if (!selectedContacts.length) {
    return res.sendStatus(204); // 204 No Content
  }

  const csvData = await exportContactsToCSV(selectedContacts, delimiter);
  return res.header('Content-Type', 'text/csv').status(200).send(csvData);
}

async function verifyCredits(
  userId: string,
  contacts: Contacts,
  contactsToExport?: string[]
) {
  const newContacts = await contacts.getNonExportedContacts(
    userId,
    contactsToExport
  );
  const previousExportedContacts = await contacts.getExportedContacts(
    userId,
    contactsToExport
  );
  const creditsInfo = await Billing!.validateCustomerCredits(
    userId,
    newContacts.length
  );
  const response = {
    total: newContacts.length + previousExportedContacts.length,
    available: Math.floor(creditsInfo.availableUnits),
    availableAlready: previousExportedContacts.length
  };
  return {
    newContacts,
    previousExportedContacts,
    creditsInfo,
    response
  };
}

async function registerAndDeductCredits(
  userId: string,
  availableUnits: number,
  contacts: Contacts,
  availableContacts: Contact[]
) {
  if (availableContacts.length) {
    await contacts.registerExportedContacts(
      availableContacts.map(({ email }) => email),
      userId
    );
    await Billing!.deductCustomerCredits(userId, availableUnits);
  }
}

async function respondWithConfirmedContacts(
  res: Response,
  userId: string,
  contacts: Contacts,
  newContacts: Contact[],
  previousExportedContacts: Contact[],
  availableUnits: number,
  statusCode: number,
  delimiterOption?: string
) {
  const availableContacts = newContacts.slice(0, availableUnits);
  const selectedContacts = [...previousExportedContacts, ...availableContacts];

  const csvData = await exportContactsToCSV(selectedContacts, delimiterOption);

  await registerAndDeductCredits(
    userId,
    availableUnits,
    contacts,
    availableContacts
  );

  return res
    .header('Content-Type', 'text/csv')
    .status(statusCode)
    .send(csvData);
}

export default function initializeContactsController(contacts: Contacts) {
  return {
    async exportContactsCSV(req: Request, res: Response, next: NextFunction) {
      const { userId, contactsToExport, partialExport, delimiter } =
        validateRequest(req, res);
      if (contactsToExport === null) {
        return res.status(400).json({
          message: 'Parameter "emails" must be a non-empty list of emails'
        });
      }

      let statusCode = 200;
      try {
        if (!Billing) {
          // No need to Verify Credits, Export.
          return await respondWithContacts(
            res,
            userId,
            contacts,
            contactsToExport,
            delimiter
          );
        }

        const { newContacts, previousExportedContacts, creditsInfo, response } =
          await verifyCredits(userId, contacts, contactsToExport);

        if (
          creditsInfo.hasDeficientCredits &&
          !previousExportedContacts.length
        ) {
          return res.status(402).json(response);
        }

        if (creditsInfo.hasInsufficientCredits && newContacts.length) {
          if (!partialExport) {
            res.statusMessage = 'Confirm Partial Content';
            return res.status(266).json(response); // 266 Confirm Partial Content
          }
          statusCode = 206; // 206 Partial Content
        }

        // Export confirmed contacts.
        return await respondWithConfirmedContacts(
          res,
          userId,
          contacts,
          newContacts,
          previousExportedContacts,
          creditsInfo.availableUnits,
          statusCode,
          delimiter
        );
      } catch (error) {
        return next(error);
      }
    }
  };
}
