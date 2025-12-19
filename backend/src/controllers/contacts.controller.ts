import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import { Contacts } from '../db/interfaces/Contacts';
import { Contact } from '../db/types';
import Billing from '../utils/billing-plugin';
import { ExportOptions, ExportType } from '../services/export/types';
import ExportFactory from '../services/export';
import {
  MiningSources,
  OAuthMiningSourceCredentials
} from '../db/interfaces/MiningSources';

async function validateRequest(
  req: Request,
  res: Response,
  miningSources: MiningSources
) {
  const user = res.locals.user as User;
  const partialExport = req.body.partialExport ?? false;
  const updateEmptyFieldsOnly = req.body.updateEmptyFieldsOnly ?? false;
  const exportType = (req.params.exportType ?? ExportType.CSV) as ExportType;

  const localeFromHeader = req.headers['accept-language'];
  const delimiterOption = req.query.delimiter?.toString();

  const validExportType = Object.values(ExportType).includes(
    exportType as ExportType
  );

  if (!validExportType) {
    throw new Error(`Invalid export type: ${exportType}`);
  }

  const oauthCredentials = (await miningSources.getCredentialsBySourceEmail(
    user.id,
    user.email as string
  )) as OAuthMiningSourceCredentials;

  const {
    emails,
    exportAllContacts
  }: { emails?: string[]; exportAllContacts: boolean } = req.body;

  if (!exportAllContacts && (!Array.isArray(emails) || !emails.length)) {
    return {
      userId: user.id,
      exportType,
      contactsToExport: null,
      partialExport,
      exportOptions: {
        locale: localeFromHeader,
        delimiter: undefined,
        googleContactsOptions: {
          accessToken: oauthCredentials?.accessToken,
          refreshToken: oauthCredentials?.refreshToken,
          updateEmptyFieldsOnly
        }
      }
    };
  }

  const contactsToExport = exportAllContacts ? undefined : emails;

  return {
    userId: user.id,
    exportType,
    contactsToExport,
    partialExport,
    exportOptions: {
      locale: localeFromHeader,
      delimiter: delimiterOption,
      googleContactsOptions: {
        accessToken: oauthCredentials?.accessToken,
        refreshToken: oauthCredentials?.refreshToken,
        updateEmptyFieldsOnly
      }
    }
  };
}

async function respondWithContacts(
  res: Response,
  userId: string,
  contacts: Contacts,
  exportType: ExportType,
  contactsToExport?: string[],
  exportOption?: ExportOptions
) {
  const selectedContacts = await contacts.getContacts(userId, contactsToExport);

  if (!selectedContacts.length) {
    return res.sendStatus(204); // 204 No Content
  }

  try {
    const { content, contentType } = await ExportFactory.get(exportType).export(
      selectedContacts,
      exportOption
    );

    return res.header('Content-Type', contentType).status(200).send(content);
  } catch (err) {
    if ((err as Error).message === 'Invalid credentials.') {
      return res.sendStatus(401);
    }
    throw err;
  }
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
  exportType: ExportType,
  contacts: Contacts,
  newContacts: Contact[],
  previousExportedContacts: Contact[],
  availableUnits: number,
  statusCode: number,
  exportOptions?: ExportOptions
) {
  const availableContacts = newContacts.slice(0, availableUnits);
  const selectedContacts = [...previousExportedContacts, ...availableContacts];

  try {
    const { content, contentType } = await ExportFactory.get(exportType).export(
      selectedContacts,
      exportOptions
    );

    await registerAndDeductCredits(
      userId,
      availableUnits,
      contacts,
      availableContacts
    );

    return res
      .header('Content-Type', contentType)
      .status(statusCode)
      .send(content);
  } catch (err) {
    if ((err as Error).message === 'Invalid credentials.') {
      return res.sendStatus(401);
    }
    throw err;
  }
}

export default function initializeContactsController(
  contacts: Contacts,
  miningSources: MiningSources
) {
  return {
    async exportContactsCSV(req: Request, res: Response, next: NextFunction) {
      const {
        userId,
        contactsToExport,
        partialExport,
        exportType,
        exportOptions
      } = await validateRequest(req, res, miningSources);
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
            exportType,
            contactsToExport,
            exportOptions
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
          exportType,
          contacts,
          newContacts,
          previousExportedContacts,
          creditsInfo.availableUnits,
          statusCode,
          exportOptions
        );
      } catch (error) {
        return next(error);
      }
    }
  };
}
