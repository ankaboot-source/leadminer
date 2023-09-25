import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import ENV from '../config';
import { Contacts } from '../db/interfaces/Contacts';
import { Users } from '../db/interfaces/Users';
import CreditsHandler from '../services/credits/creditHandler';
import {
  exportContactsToCSV,
  getLocalizedCsvSeparator
} from '../utils/helpers/csv';

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

        if (ENV.ENABLE_CREDIT && ENV.CONTACT_CREDIT) {
          const creditHandler = new CreditsHandler(
            userResolver,
            ENV.CONTACT_CREDIT
          );
          const { insufficientCredits, requestedUnits, availableUnits } =
            await creditHandler.validate(user.id, newContacts.length);

          const response = {
            newContacts: newContacts.length,
            totalContacts: previousExportedContacts.length,
            availableContacts: insufficientCredits ? 0 : availableUnits
          };

          let statusCode = 200;
          if (insufficientCredits && availableUnits) {
            statusCode = creditHandler.INSUFFICIENT_CREDITS_STATUS;
          } else if (availableUnits !== requestedUnits) {
            statusCode = 206;
          }

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

        if (ENV.ENABLE_CREDIT && ENV.CONTACT_CREDIT) {
          const creditHandler = new CreditsHandler(
            userResolver,
            ENV.CONTACT_CREDIT
          );

          const newContacts = await contacts.getNonExportedContacts(user.id);
          const previousExportedContacts = await contacts.getExportedContacts(
            user.id
          );

          const { insufficientCredits, requestedUnits, availableUnits } =
            await creditHandler.validate(user.id, newContacts.length);

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
            await creditHandler.deduct(user.id, availableUnits);
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
