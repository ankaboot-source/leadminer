import { z } from 'zod';

// eslint-disable-next-line import/prefer-default-export
export const exportContactsSchema = z.object({
  params: z.object({
    exportType: z.enum(['csv', 'vcard', 'google_contacts']).or(z.string()),
  }),
  body: z.object({
    partialExport: z.boolean().optional(),
    updateEmptyFieldsOnly: z.boolean().optional(),
    targetEmail: z.string().optional(),
    emails: z.array(z.string()).optional(),
    exportAllContacts: z.boolean().optional(),
  }),
  query: z.object({
    delimiter: z.string().max(1).optional(),
  }),
});
