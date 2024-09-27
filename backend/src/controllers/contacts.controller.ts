import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import { Contacts } from '../db/interfaces/Contacts';
import { Users } from '../db/interfaces/Users';
import { Contact } from '../db/types';
import CreditsHandler from '../services/credits/creditsHandler';
import {
  exportContactsToCSV,
  getLocalizedCsvSeparator
} from '../utils/helpers/csv';

async function validateRequest(req: Request, res: Response) {
  const user = res.locals.user as User;

  const partialExport = req.body.partialExport ?? false;
  const {
    emails,
    exportAllContacts
  }: { emails?: string[]; exportAllContacts: boolean } = req.body;

  if (!exportAllContacts && (!Array.isArray(emails) || !emails.length)) {
    res.status(400).json({
      message: 'Parameter "emails" must be a non-empty list of emails'
    });
  }

  const contactsToExport = exportAllContacts ? undefined : emails;

  const delimiterOption = req.query.delimiter
    ? String(req.query.delimiter)
    : undefined;
  const localeFromHeader = req.headers['accept-language'];

  const delimiter =
    delimiterOption ?? getLocalizedCsvSeparator(localeFromHeader ?? '');

  return {
    userId: user.id,
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

  const csvData = exportContactsToCSV(selectedContacts, delimiter);
  return res.header('Content-Type', 'text/csv').status(200).send(csvData);
}

async function verifyCredits(
  userId: string,
  userResolver: Users,
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

  // Verify Credits
  const creditsHandler = new CreditsHandler(
    userResolver,
    ENV.CREDITS_PER_CONTACT
  );
  const creditsInfo = await creditsHandler.validate(userId, newContacts.length);

  const response = {
    total: newContacts.length + previousExportedContacts.length,
    available: Math.floor(creditsInfo.availableUnits),
    availableAlready: previousExportedContacts.length
  };

  return {
    newContacts,
    previousExportedContacts,
    creditsHandler,
    creditsInfo,
    response
  };
}

async function registerAndDeductCredits(
  userId: string,
  creditsHandler: CreditsHandler,
  availableUnits: number,
  contacts: Contacts,
  availableContacts: Contact[]
) {
  if (availableContacts.length) {
    await contacts.registerExportedContacts(
      availableContacts.map(({ email }) => email),
      userId
    );
    await creditsHandler.deduct(userId, availableUnits);
  }
}

function getAvailableAndSelectedContacts(
  newContacts: Contact[],
  previousExportedContacts: Contact[],
  availableUnits: number
) {
  const availableContacts = newContacts.slice(0, availableUnits);
  const selectedContacts = [...previousExportedContacts, ...availableContacts];

  return { availableContacts, selectedContacts };
}

async function respondWithConfirmedContacts(
  res: Response,
  userId: string,
  contacts: Contacts,
  newContacts: Contact[],
  previousExportedContacts: Contact[],
  creditsHandler: CreditsHandler,
  availableUnits: number,
  statusCode: number,
  delimiterOption?: string
) {
  const { availableContacts, selectedContacts } =
    getAvailableAndSelectedContacts(
      newContacts,
      previousExportedContacts,
      availableUnits
    );

  const csvData = await exportContactsToCSV(selectedContacts, delimiterOption);

  await registerAndDeductCredits(
    userId,
    creditsHandler,
    availableUnits,
    contacts,
    availableContacts
  );

  return res
    .header('Content-Type', 'text/csv')
    .status(statusCode)
    .send(csvData);
}

export default function initializeContactsController(
  contacts: Contacts,
  userResolver: Users
) {
  return {
    async exportContactsCSV(req: Request, res: Response, next: NextFunction) {
      const { userId, contactsToExport, partialExport, delimiter } =
        await validateRequest(req, res);

      let statusCode = 200;
      try {
        if (!ENV.ENABLE_CREDIT || !ENV.CREDITS_PER_CONTACT) {
          // No need to Verify Credits, Export.
          return await respondWithContacts(
            res,
            userId,
            contacts,
            contactsToExport,
            delimiter
          );
        }

        const {
          newContacts,
          previousExportedContacts,
          creditsHandler,
          creditsInfo,
          response
        } = await verifyCredits(
          userId,
          userResolver,
          contacts,
          contactsToExport
        );

        if (
          creditsInfo.hasDeficientCredits &&
          !previousExportedContacts.length
        ) {
          return res
            .status(creditsHandler.DEFICIENT_CREDITS_STATUS) // 402 Payment Required
            .json(response);
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
          creditsHandler,
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
