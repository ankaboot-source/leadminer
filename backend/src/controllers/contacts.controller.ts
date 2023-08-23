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

export default function initializeContactsController(
  contacts: Contacts,
  userResolver: Users
) {
  return {
    async exportContactsCSV(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;
      try {
        const minedContacts = await contacts.getContactsTable(user.id);

        if (!minedContacts || minedContacts.length === 0) {
          return res
            .status(404)
            .json({ message: 'No contacts available for export' });
        }

        const delimiterOption = req.query.delimiter;
        const localeFromHeader = req.headers['accept-language'];
        const csvSeparator = delimiterOption
          ? String(delimiterOption)
          : getLocalizedCsvSeparator(localeFromHeader ?? '');

        const csvData = minedContacts.map((contact) => ({
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

        // Call credit verification process if enabled
        const succesfullOp = await createCreditHandler(
          ENV.ENABLE_CREDIT,
          ENV.CONTACT_CREDIT
        )?.process(user.id, minedContacts.length, userResolver);

        console.log(succesfullOp);

        if (!succesfullOp) {
          return res
            .status(INSUFFICIENT_CREDITS_STATUS)
            .json({ message: INSUFFICIENT_CREDITS_MESSAGE });
        }

        return res.header('Content-Type', 'text/csv').status(200).send(csvStr);
      } catch (err) {
        return next(err);
      }
    }
  };
}
