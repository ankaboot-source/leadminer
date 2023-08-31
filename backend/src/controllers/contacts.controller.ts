import { User } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import { Logger } from 'winston';
import ENV from '../config';
import { Contacts } from '../db/interfaces/Contacts';
import { Users } from '../db/interfaces/Users';
import EmailStatusCache from '../services/cache/EmailStatusCache';
import { EmailStatusVerifier } from '../services/email-status/EmailStatusVerifier';
import { chunkGenerator } from '../utils/array';
import {
  INSUFFICIENT_CREDITS_MESSAGE,
  INSUFFICIENT_CREDITS_STATUS,
  createCreditHandler
} from '../utils/billing/credits';
import {
  exportContactsToCSV,
  getLocalizedCsvSeparator
} from '../utils/helpers/csv';

export default function initializeContactsController(
  contacts: Contacts,
  userResolver: Users,
  emailStatusVerifier: EmailStatusVerifier,
  emailStatusCache: EmailStatusCache,
  logger: Logger
) {
  return {
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

        const creditHandler = createCreditHandler(
          ENV.ENABLE_CREDIT,
          ENV.CONTACT_CREDIT,
          userResolver
        );

        if (creditHandler) {
          // If creditHandler is available, we only use this path.
          const newContacts = await contacts.getNonExportedContacts(user.id);
          const previousExportedContacts = await contacts.getExportedContacts(
            user.id
          );

          const { insufficientCredits, requestedUnits, availableUnits } =
            await creditHandler.validateCreditUsage(
              user.id,
              newContacts.length
            );

          if (insufficientCredits && availableUnits) {
            return res
              .status(INSUFFICIENT_CREDITS_STATUS)
              .json({ message: INSUFFICIENT_CREDITS_MESSAGE });
          }

          const contactsToExport = [
            ...previousExportedContacts,
            ...newContacts.slice(0, availableUnits)
          ];

          const csvData = await exportContactsToCSV(
            contactsToExport,
            csvSeparator
          );

          if (availableUnits) {
            await contacts.registerExportedContacts(
              newContacts.map(({ id }) => id),
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
    },

    async verifyContacts(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;

      try {
        const chunkSize = 120;
        const unverifiedEmails = await contacts.getUnverifiedEmails(user.id);

        const fn = async (emailsChunk: string[]) => {
          try {
            const results = await emailStatusVerifier.verifyMany(emailsChunk);
            await Promise.allSettled([
              emailStatusCache.setMany(results),
              contacts.updateManyPersonsStatus(user.id, results)
            ]);
          } catch (error) {
            logger.error(error);
          }
        };

        const promises = [];
        const startedAt = performance.now();
        const chunkIterator = chunkGenerator(unverifiedEmails, chunkSize);

        for (const chunk of chunkIterator) {
          promises.push(fn(chunk));
        }

        await Promise.all(promises);

        logger.info(
          `Full verification took ${(
            (performance.now() - startedAt) /
            1000
          ).toFixed(2)} seconds`,
          { count: unverifiedEmails.length }
        );
        logger.info('Success');
        return res.json({ message: 'Success' });
      } catch (error) {
        return next(error);
      }
    }
  };
}
