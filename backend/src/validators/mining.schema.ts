import { z } from 'zod';
import { stringField, positiveNumber, stringArray } from './index';

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
  body: z.object({
    miningSource: z
      .object({
        email: stringField.optional(),
        id: stringField.optional()
      })
      .refine((data) => data.email || data.id, {
        message: 'Either miningSource.email or miningSource.id is required'
      }),
    boxes: stringArray,
    extractSignatures: z.boolean(),
    cleaningEnabled: z.boolean(),
    since: z.string().optional(),
    passive_mining: z.boolean().optional(),
    googleContactsSync: z.boolean().optional()
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
