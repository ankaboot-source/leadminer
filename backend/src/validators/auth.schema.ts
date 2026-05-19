import { z } from 'zod';

// eslint-disable-next-line import/prefer-default-export
export const deleteUserSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional()
});
