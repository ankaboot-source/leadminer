import { NextFunction, Request, Response } from 'express';
import { User } from '@supabase/supabase-js';
import { Contacts } from '../db/interfaces/Contacts';
import {
  exportContactsToCSV,
  getLocalizedCsvSeparator
} from '../utils/helpers/csv';
import ENV from '../config';
import { createCreditHandler } from '../utils/credits';
import { Users } from '../db/interfaces/Users';

export default function initializeContactsController(
  contacts: Contacts,
  userResolver: Users
) {
  return {
    async verifyExportContacts(_: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;
      try {
        const newContacts = await contacts.getNonExportedContacts(user.id);
        const previousExportedContacts = await contacts.getExportedContacts(
          user.id
        );
        const creditHandler = await createCreditHandler(
          ENV.CONTACT_CREDIT,
          userResolver
        );

        if (creditHandler) {
          const { insufficientCredits, requestedUnits, availableUnits } =
            await creditHandler.validateCreditUsage(
              user.id,
              newContacts.length
            );

          const insufficientCreditsStatusCode =
            insufficientCredits && availableUnits
              ? creditHandler.INSUFFICIENT_CREDITS_STATUS
              : null;
          const statusCode =
            insufficientCreditsStatusCode ??
            (availableUnits !== requestedUnits ? 206 : 200);

          const response = {
            newContacts: newContacts.length,
            totalContacts: previousExportedContacts.length,
            availableContacts: insufficientCredits ? 0 : availableUnits
          };

          return res.status(statusCode).json(response);
        }

        return res.sendStatus(200);
      } catch (error) {
        return next(error);
      }
    },

    async exportContactsCSV(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;
      try {
        const minedContacts = await contacts.getContacts(user.id);

        if (minedContacts.length === 0) {
          return res
            .status(404)
            .json({ message: 'No contacts available for export' });
        }

        const delimiterOption = req.query.delimiter;
        const localeFromHeader = req.headers['accept-language'];
        const csvSeparator = delimiterOption
          ? String(delimiterOption)
          : getLocalizedCsvSeparator(localeFromHeader ?? '');

        const creditHandler = await createCreditHandler(
          ENV.CONTACT_CREDIT,
          userResolver
        );

        if (creditHandler) {
          const newContacts = await contacts.getNonExportedContacts(user.id);
          const previousExportedContacts = await contacts.getExportedContacts(
            user.id
          );

          const { insufficientCredits, requestedUnits, availableUnits } =
            await creditHandler.validateCreditUsage(
              user.id,
              newContacts.length
            );

          const availableContacts = newContacts.slice(0, availableUnits);
          const contactsToExport = [
            ...previousExportedContacts,
            ...availableContacts
          ];

          const csvData = await exportContactsToCSV(
            contactsToExport,
            csvSeparator
          );

          if (insufficientCredits === false && availableUnits) {
            await contacts.registerExportedContacts(
              availableContacts.map(({ email }) => email),
              user.id
            );
            await creditHandler.deductCredits(user.id, availableUnits);
          }

          return res
            .header('Content-Type', 'text/csv')
            .status(availableUnits === requestedUnits ? 200 : 206)
            .send(csvData);
        }

        const csvData = await exportContactsToCSV(minedContacts, csvSeparator);
        return res.header('Content-Type', 'text/csv').status(200).send(csvData);
      } catch (err) {
        return next(err);
      }
    }
  };
}
