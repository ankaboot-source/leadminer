import { z } from 'zod';
import { stringField } from './index';

// eslint-disable-next-line import/prefer-default-export
export const getImapBoxesSchema = z.object({
  body: z.object({
    email: stringField
  })
});
