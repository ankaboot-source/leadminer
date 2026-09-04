import { z } from 'zod';
import { stringField, positiveNumber } from './index';

export const createImapMiningSourceSchema = z.object({
  body: z.object({
    email: stringField,
    host: stringField,
    password: stringField,
    port: positiveNumber,
    secure: z.boolean()
  })
});

export const startMiningSchema = z.object({
  params: z.object({
    userId: stringField
  }),
  body: z
    .object({
      miningSource: z
        .object({
          email: stringField.optional(),
          id: stringField.optional()
        })
        .refine((data) => data.email || data.id, {
          message: 'Either miningSource.email or miningSource.id is required'
        }),
      boxes: z
        .array(z.string().min(1, 'must be a non-empty string'))
        .default([]),
      extractSignatures: z.boolean(),
      cleaningEnabled: z.boolean(),
      since: z.string().nullable().optional(),
      passive_mining: z.boolean().optional(),
      googleContactsSync: z.boolean().optional()
    })
    .refine((data) => data.googleContactsSync || data.boxes.length > 0, {
      message: 'boxes must be non-empty when Google Contacts sync is disabled',
      path: ['boxes']
    })
});

export const startMiningFileSchema = z.object({
  params: z.object({
    userId: stringField
  }),
  body: z.object({
    name: stringField,
    contacts: z.array(z.any()).min(1, 'contacts must be a non-empty array'),
    cleaningEnabled: z.boolean()
  })
});

export const startMiningPSTSchema = z.object({
  params: z.object({
    userId: stringField
  }),
  body: z.object({
    name: stringField,
    extractSignatures: z.boolean(),
    cleaningEnabled: z.boolean()
  })
});

export const stopMiningTaskSchema = z.object({
  params: z.object({
    type: stringField,
    userId: stringField,
    id: stringField
  }),
  body: z.object({
    processes: z.array(z.string()).optional(),
    endEntireTask: z.boolean().optional()
  })
});
