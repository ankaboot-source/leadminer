import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import { Contacts } from '../db/interfaces/Contacts';
import { Users } from '../db/interfaces/Users';
import { Contact } from '../db/types';
import CreditsHandler from '../services/credits/creditHandler';
import {
  exportContactsToCSV,
  getLocalizedCsvSeparator
} from '../utils/helpers/csv';

async function exportToCSV(
  contactsToExport: Contact[],
  delimiterOption: string | undefined,
  localeFromHeader: string | undefined
) {
  const csvSeparator =
    delimiterOption ?? getLocalizedCsvSeparator(localeFromHeader ?? '');
  const csvData = await exportContactsToCSV(contactsToExport, csvSeparator);
  return csvData;
}
export default function initializeContactsController(
  contacts: Contacts,
  userResolver: Users
) {
  return {
    async exportContactsCSV(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;
      const partialExport = req.body.partialExport ?? false;
      const { contactsToExport }: { contactsToExport: string[] | undefined } =
        req.body;
      if (
        contactsToExport !== undefined &&
        (!Array.isArray(contactsToExport) || !contactsToExport.length)
      ) {
        return res.status(400).json({
          message:
            'Parameter "contactsToExport" must be a non-empty list of emails or undefined'
        });
      }

      let statusCode = 200;

      try {
        if (!ENV.ENABLE_CREDIT || !ENV.CONTACT_CREDIT) {
          // No need to Verify Credits, Export.

          const selectedContacts = await contacts.getContacts(
            user.id,
            contactsToExport
          );

          if (!selectedContacts.length) {
            statusCode = 204; // 204 No Content
            return res.sendStatus(statusCode);
          }

          const csvData = await exportToCSV(
            selectedContacts,
            req.query.delimiter ? String(req.query.delimiter) : undefined,
            req.headers['accept-language']
          );
          return res
            .header('Content-Type', 'text/csv')
            .status(statusCode)
            .send(csvData);
        }

        // Verify
        const newContacts = await contacts.getNonExportedContacts(
          user.id,
          contactsToExport
        );

        const previousExportedContacts = await contacts.getExportedContacts(
          user.id,
          contactsToExport
        );

        // Verify Credits
        const creditHandler = new CreditsHandler(
          userResolver,
          ENV.CONTACT_CREDIT
        );
        const { hasDeficientCredits, hasInsufficientCredits, availableUnits } =
          await creditHandler.validate(user.id, newContacts.length);

        if (hasDeficientCredits && !previousExportedContacts.length) {
          statusCode = creditHandler.DEFICIENT_CREDITS_STATUS; // 402 Payment Required
          const response = {
            total: newContacts.length + previousExportedContacts.length,
            available: Math.floor(availableUnits),
            availableAlready: previousExportedContacts.length
          };
          return res.status(statusCode).json(response);
        }
        if (hasInsufficientCredits && newContacts.length) {
          statusCode = 206; // 206 Partial Content
          if (!partialExport) {
            statusCode = 266; // 266 Confirm Partial Content
            res.statusMessage = 'Confirm Partial Content';
            const response = {
              total: newContacts.length + previousExportedContacts.length,
              available: Math.floor(availableUnits),
              availableAlready: previousExportedContacts.length
            };
            return res.status(statusCode).json(response);
          }
        }
        // Verified, Export.
        const availableContacts = newContacts.slice(0, availableUnits);
        const selectedContacts = [
          ...previousExportedContacts,
          ...availableContacts
        ];

        const csvData = await exportToCSV(
          selectedContacts,
          req.query.delimiter ? String(req.query.delimiter) : undefined,
          req.headers['accept-language']
        );

        if (availableContacts.length) {
          await contacts.registerExportedContacts(
            availableContacts.map(({ email }) => email),
            user.id
          );
          await creditHandler.deduct(user.id, availableUnits);
        }

        return res
          .header('Content-Type', 'text/csv')
          .status(statusCode)
          .send(csvData);
      } catch (error) {
        return next(error);
      }
    }
  };
}
