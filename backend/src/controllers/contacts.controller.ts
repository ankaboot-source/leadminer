import { NextFunction, Request, Response } from 'express';
import { User } from '@supabase/supabase-js';
import { Contacts } from '../db/interfaces/Contacts';
import { getCsvStr, getLocalizedCsvSeparator } from '../utils/helpers/csv';
import ENV from '../config';
import {
  INSUFFICIENT_CREDITS_STATUS,
  INSUFFICIENT_CREDITS_MESSAGE,
  createCreditHandler
} from '../utils/billing/credits';
import { Users } from '../db/interfaces/Users';
import { Contact } from '../db/types';

export default function initializeContactsController(
  contacts: Contacts,
  userResolver: Users
) {
  return {
    async exportContactsCSV(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;
      try {
        const freshContacts = (await contacts.getContacts(user.id, true)) ?? [];
        const previousExportedContacts =
          (await contacts.getExportedContacts(user.id)) ?? [];

        if (
          freshContacts.length === 0 &&
          previousExportedContacts.length === 0
        ) {
          return res
            .status(404)
            .json({ message: 'No contacts available for export' });
        }

        const creditHandler = createCreditHandler(
          ENV.ENABLE_CREDIT,
          ENV.CONTACT_CREDIT,
          userResolver
        );

        const { credits, accessAllUnits, availableUnits } =
          (await creditHandler?.validateCreditUsage(
            user.id,
            freshContacts.length
          )) ?? {};

        if (availableUnits && credits === 0) {
          return res
            .status(INSUFFICIENT_CREDITS_STATUS)
            .json({ message: INSUFFICIENT_CREDITS_MESSAGE });
        }

        // Minimize the length based on totalContactsForExport if available,
        freshContacts.length = availableUnits ?? freshContacts.length;

        // Group all old and new contacts
        const contactstoExport: Contact[] = [
          ...previousExportedContacts,
          ...freshContacts
        ];

        const delimiterOption = req.query.delimiter;
        const localeFromHeader = req.headers['accept-language'];
        const csvSeparator = delimiterOption
          ? String(delimiterOption)
          : getLocalizedCsvSeparator(localeFromHeader ?? '');

        const csvData = contactstoExport.map((contact) => ({
          name: contact.name?.trim(),
          email: contact.email,
          recency: contact.recency
            ? new Date(contact.recency).toISOString().slice(0, 10)
            : '',
          seniority: contact.seniority
            ? new Date(contact.seniority).toISOString().slice(0, 10)
            : '',
          occurrence: contact.occurrence,
          sender: contact.sender,
          recipient: contact.recipient,
          conversations: contact.conversations,
          repliedConversations: contact.replied_conversations,
          tags: contact.tags?.join('\n'),
          status: contact.status
        }));

        const csvStr = await getCsvStr(
          [
            { key: 'name', header: 'Name' },
            { key: 'email', header: 'Email' },
            { key: 'recency', header: 'Recency' },
            { key: 'seniority', header: 'Seniority' },
            { key: 'occurrence', header: 'Occurrence' },
            { key: 'sender', header: 'Sender' },
            { key: 'recipient', header: 'Recipient' },
            { key: 'conversations', header: 'Conversations' },
            { key: 'repliedConversations', header: 'Replied conversations' },
            { key: 'tags', header: 'Tags' },
            { key: 'status', header: 'Status' }
          ],
          csvData,
          csvSeparator
        );

        // Deduct credits from user account
        await creditHandler?.deductCredits(user.id, availableUnits ?? 0);

        await contacts.registerExportedContacts(
          freshContacts.map(({ id }) => id),
          user.id
        );

        // Determine the HTTP status code based on whether all units can be accessed
        const httpStatusCode = accessAllUnits ? 200 : 206;

        return res
          .header('Content-Type', 'text/csv')
          .status(httpStatusCode)
          .send(csvStr);
      } catch (err) {
        return next(err);
      }
    }
  };
}
