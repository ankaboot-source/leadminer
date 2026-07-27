import { Request, Response } from 'express';
import logger from '../utils/logger';
import { clearMessageStore, getState } from '../store/messageStore';
import { redactMessage } from '../utils/redaction';
import ENV from '../config';

export function getMessagesRoute(req: Request, res: Response) {
  const campaignId = req.query.campaignId as string | undefined;
  const provider = req.query.provider as string | undefined;
  const phone = req.query.phone as string | undefined;
  const limit = Math.min(
    parseInt((req.query.limit as string) || '100', 10),
    1000
  );
  const offset = parseInt((req.query.offset as string) || '0', 10);
  const full = req.query.full === 'true';
  const mockToken = ENV.SMS_GATEWAY_MOCK_TOKEN;

  // Check full access
  if (full) {
    const token = req.headers['x-mock-token'] as string | undefined;
    if (!token || token !== mockToken) {
      return res.status(401).json({
        error: 'Invalid or missing X-Mock-Token for full data'
      });
    }
  }

  // Build filtered list
  let messages = Array.from(getState().messageStore.values());

  if (campaignId) {
    const ids = getState().campaignIndex.get(campaignId);
    if (ids) {
      messages = messages.filter((m) => ids.has(m.id));
    } else {
      messages = [];
    }
  }

  if (provider) {
    messages = messages.filter((m) => m.provider === provider);
  }

  if (phone) {
    messages = messages.filter((m) => m.phone === phone);
  }

  const total = messages.length;

  // Sort by timestamp descending
  messages.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Apply pagination
  messages = messages.slice(offset, offset + limit);

  // Redact PII unless full access
  const redacted = messages.map((m) => redactMessage(m, full));

  return res.json({
    messages: redacted,
    total,
    limit,
    offset
  });
}

export function deleteMessagesRoute(req: Request, res: Response) {
  clearMessageStore();
  logger.info('All messages cleared');
  return res.json({ success: true, message: 'All messages cleared' });
}
