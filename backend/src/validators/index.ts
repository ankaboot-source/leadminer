import { z } from 'zod';

export const stringField = z.string().min(1, 'must be a non-empty string');
export const positiveNumber = z.number().positive('must be a valid positive number');
export const stringArray = z.array(z.string().min(1, 'must be a non-empty string')).min(1, 'must be an array of non-empty strings');
