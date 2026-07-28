import { Request, Response } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { updateConfig } from '../store/messageStore';

const providerOverrideSchema = z.object({
  successRate: z.number().min(0).max(1).optional(),
  failStatusCode: z.number().min(400).max(599).optional(),
  failMessage: z.string().optional(),
  delayMs: z.number().min(0).max(60000).optional()
});

const partialConfigSchema = z.object({
  global: z
    .object({
      successRate: z.number().min(0).max(1).optional(),
      delayMs: z.number().min(0).max(60000).optional(),
      failMessage: z.string().optional(),
      failStatusCode: z.number().min(400).max(599).optional(),
      sequentialId: z.boolean().optional(),
      idPrefix: z.string().optional()
    })
    .optional(),
  providers: z
    .object({
      smsgate: providerOverrideSchema.optional(),
      'simple-sms-gateway': providerOverrideSchema.optional()
    })
    .optional()
});

export default function configRoute(req: Request, res: Response) {
  try {
    const { body } = req;
    const validation = partialConfigSchema.safeParse(body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid config',
        details: validation.error.issues
      });
    }

    // Deep merge global config
    const { data: validatedData } = validation;
    const newConfig = updateConfig(validatedData);

    logger.info('Config updated', { config: newConfig });

    return res.json({
      success: true,
      config: { ...newConfig }
    });
  } catch (error) {
    logger.error('Failed to update config', {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(400).json({ error: 'Failed to parse config' });
  }
}
