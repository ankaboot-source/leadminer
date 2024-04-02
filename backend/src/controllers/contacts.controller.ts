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
      const contactsToExport = JSON.parse(req.body.contactsToExport);

      if (!contactsToExport.length) {
        return res.sendStatus(204);
      }

      try {
        // Verify
        let statusCode = 200;

        const newContacts = await contacts.getNonExportedContacts(user.id); // !
        const previousExportedContacts = await contacts.getExportedContacts(
          user.id
        );
        if (!(newContacts.length + previousExportedContacts.length)) {
          statusCode = 204; // 204 No Content
          return res.sendStatus(204);
        }

        // Verify Credits
        if (ENV.ENABLE_CREDIT && ENV.CONTACT_CREDIT) {
          const creditHandler = new CreditsHandler(
            userResolver,
            ENV.CONTACT_CREDIT
          );

          const {
            hasDeficientCredits,
            hasInsufficientCredits,
            availableUnits
          } = await creditHandler.validate(user.id, newContacts.length);

          if (hasDeficientCredits) {
            statusCode = creditHandler.DEFICIENT_CREDITS_STATUS; // 402 Payment Required
            const response = {
              total: newContacts.length + previousExportedContacts.length,
              available: hasDeficientCredits ? 0 : availableUnits
            };
            return res.status(statusCode).json(response);
          }
          if (hasInsufficientCredits) {
            statusCode = 206; // 206 Partial Content
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

          await contacts.registerExportedContacts(
            availableContacts.map(({ email }) => email),
            user.id
          );
          await creditHandler.deduct(user.id, availableUnits);

          return res
            .header('Content-Type', 'text/csv')
            .status(statusCode)
            .send(csvData);
        }

        // No need to Verify Credits, Export.
        const selectedContacts = await contacts.getSelectedContacts(
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

        return res.header('Content-Type', 'text/csv').status(200).send(csvData);
      } catch (error) {
        return next(error);
      }
    }
  };
}
