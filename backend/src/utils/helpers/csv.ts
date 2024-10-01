import { stringify } from 'csv-stringify';
import { Contact } from '../../db/types';

export function getLocalizedCsvSeparator(locale?: string) {
  const language = locale?.substring(0, 2);

  switch (language) {
    case 'fr':
    case 'de':
    case 'es':
    case 'pt':
    case 'it':
      return ';';
    default:
      return ',';
  }
}

export function getCsvStr<T>(
  columns: { key: keyof T; header: string }[],
  rows: T[],
  delimiter: string
) {
  return new Promise<string>((resolve, reject) => {
    stringify(
      rows,
      {
        columns: columns.map(({ key, header }) => ({
          key: String(key),
          header
        })),
        bom: true,
        delimiter,
        header: true,
        quoted_string: true
      },
      (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      }
    );
  });
}

export function exportContactsToCSV(contacts: Contact[], csvSeparator = ',') {
  const csvData = contacts.map((contact) => ({
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
    tags: contact.tags?.join(','),
    status: contact.status,
    given_name: contact.given_name,
    family_name: contact.family_name,
    alternate_names: contact.alternate_names?.join(','),
    location: contact.location?.join(','),
    works_for: contact.works_for,
    job_title: contact.job_title,
    same_as: contact.same_as?.join(','),
    image: contact.image
  }));

  return getCsvStr(
    [
      { key: 'name', header: 'Name' },
      { key: 'email', header: 'Email' },
      { key: 'recency', header: 'Recency' },
      { key: 'seniority', header: 'Seniority' },
      { key: 'occurrence', header: 'Occurrence' },
      { key: 'sender', header: 'Sender' },
      { key: 'recipient', header: 'Recipient' },
      { key: 'conversations', header: 'Conversations' },
      { key: 'repliedConversations', header: 'Replies' },
      { key: 'tags', header: 'Tags' },
      { key: 'status', header: 'Reachable' },
      { key: 'given_name', header: 'Given name' },
      { key: 'family_name', header: 'Family name' },
      { key: 'alternate_names', header: 'Alternate names' },
      { key: 'location', header: 'Location' },
      { key: 'works_for', header: 'Works for' },
      { key: 'job_title', header: 'Job title' },
      { key: 'same_as', header: 'Same as' },
      { key: 'image', header: 'Avatar URL' }
    ],
    csvData,
    csvSeparator
  );
}
