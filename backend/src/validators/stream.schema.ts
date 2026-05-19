import { z } from 'zod';
import { stringField } from './index';

// eslint-disable-next-line import/prefer-default-export
export const streamProgressSchema = z.object({
  params: z.object({
    type: stringField,
    id: stringField
  })
});
