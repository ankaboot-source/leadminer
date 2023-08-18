import { NextFunction, Request, Response } from 'express';
import { User } from '@supabase/supabase-js';
import { Contacts } from '../db/Contacts';
import getCsvStr from '../utils/helpers/csv';
import AuthResolver from '../services/auth/AuthResolver';

export default function initializeContactsController(
  contacts: Contacts,
  authResolver: AuthResolver
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

        const userAccount = await authResolver.getUserProfile(user.id);

        if (!userAccount) {
          throw new Error('Cannot get user profile.');
        }
        const { total_credits: totalCredits } = userAccount;

        if (totalCredits <= 0) {
          return res
            .status(203)
            .json({ message: 'Insufficient credits available.' });
        }

        // Calculate export quota
        const creditPerExportedContact = 10;
        const exportQuota = minedContacts.length * creditPerExportedContact;

        if (totalCredits < exportQuota) {
          return res
            .status(403)
            .json({ message: 'Insufficient credits available.' });
        }

        // Deduct credits from the user account credits
        const updatedCredit = await authResolver.updateUserProfile(user.id, {
          total_credits: totalCredits - exportQuota
        });

        if (!updatedCredit) {
          throw new Error('Failed to update the user credits.');
        }

        const csvSeparator = String(req.query.delimiter ?? ',');

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
        return res.header('Content-Type', 'text/csv').status(200).send(csvStr);
      } catch (err) {
        return next(err);
      }
    }
  };
}
