import { z } from 'zod';
import { stringField } from './index';

export const enrichPersonSchema = z.object({
  body: z.object({
    contact: z.any().optional(),
    contacts: z.array(z.any()).optional(),
    enrichAllContacts: z.boolean().optional(),
    updateEmptyFieldsOnly: z.boolean().optional(),
  }),
});

export const enrichWebhookSchema = z.object({
  params: z.object({
    id: stringField,
  }),
  body: z.object({
    token: z.string().optional(),
  }).passthrough(),
});
