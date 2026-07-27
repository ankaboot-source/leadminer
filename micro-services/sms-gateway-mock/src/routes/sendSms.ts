import { Request, Response } from 'express';
import logger from '../utils/logger';
import {
  addMessage,
  generateMessageId,
  getEffectiveConfig
} from '../store/messageStore';
import { extractCampaignId } from '../utils/campaignId';
import {
  validateProvider,
  validateSmsgateAuth,
  extractPayload,
  recordSimulatedMessage
} from './sendSmsHelpers';

export async function sendSmsRoute(req: Request, res: Response) {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();
  const { provider } = req.params;

  // 1. Validate provider → 404 if invalid
  const validProvider = validateProvider(provider);
  if (!validProvider) {
    return res.status(404).json({
      message: `Unknown provider: ${provider}`,
      success: false
    });
  }

  // 2. Validate smsgate auth → 401 if invalid
  if (validProvider === 'smsgate') {
    const credentials = validateSmsgateAuth(req.headers.authorization);
    if (!credentials) {
      logger.warn('Missing or invalid Basic Auth for smsgate', { timestamp });
      return res.status(401).json({
        message: 'Missing or invalid Authorization header',
        success: false
      });
    }
    logger.debug('smsgate auth attempt', {
      timestamp,
      username: credentials.username
    });
  }

  try {
    const campaignId = extractCampaignId(validProvider, req.headers, req.body);

    // 3. Extract payload → 400 if invalid
    const payload = extractPayload(validProvider, req.body);
    if (!payload.ok) {
      logger.warn(`Invalid SMS request (${validProvider})`, {
        timestamp,
        error: payload.error.message
      });
      return res.status(payload.error.status).json({
        message: payload.error.message,
        success: false
      });
    }
    const { phone, message } = payload;
    const messageLength = message.length;

    // 4. Look up effective config
    const cfg = getEffectiveConfig(validProvider);

    logger.info('SMS request received', {
      timestamp,
      provider: validProvider,
      phone,
      messageLength,
      campaignId,
      configSnapshot: { ...cfg }
    });

    // 5. Apply delay
    if (cfg.delayMs > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, cfg.delayMs);
      });
    }

    // 6. Compute success/failure
    const shouldFail = Math.random() > cfg.successRate;
    const durationMs = Date.now() - startTime;

    // 7-8. Build StoredMessage and store
    const messageId = shouldFail ? undefined : generateMessageId(cfg);
    const storedMessage = recordSimulatedMessage({
      provider: validProvider,
      phone,
      message,
      messageLength,
      campaignId,
      timestamp,
      durationMs,
      success: !shouldFail,
      cfg,
      messageId
    });
    addMessage(storedMessage);

    // 9. Return response
    if (shouldFail) {
      logger.info('SMS send failed (mock)', {
        timestamp,
        provider: validProvider,
        phone,
        messageLength,
        campaignId,
        result: 'error',
        statusCode: cfg.failStatusCode,
        durationMs
      });
      return res.status(cfg.failStatusCode).json({
        message: cfg.failMessage,
        success: false
      });
    }

    logger.info('SMS send success (mock)', {
      timestamp,
      provider: validProvider,
      phone,
      messageLength,
      campaignId,
      result: 'success',
      messageId,
      durationMs
    });

    return res.json({ id: messageId, messageId, success: true });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Unexpected error in /:provider/send-sms', {
      timestamp,
      provider: validProvider,
      error: error instanceof Error ? error.message : String(error),
      durationMs
    });

    return res.status(500).json({
      message: 'Internal server error',
      success: false
    });
  }
}

export default sendSmsRoute;
