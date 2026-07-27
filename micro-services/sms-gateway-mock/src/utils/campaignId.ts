import type { IncomingHttpHeaders } from 'http';
import logger from './logger';

export function extractCampaignId(
  provider: string,
  headers: IncomingHttpHeaders,
  body?: Record<string, unknown>
): string | undefined {
  // Primary: X-Campaign-Id header (case-insensitive lookup via Node's IncomingHttpHeaders)
  const headerCampaignId = headers['x-campaign-id'];
  if (
    headerCampaignId &&
    typeof headerCampaignId === 'string' &&
    headerCampaignId.length > 0
  ) {
    return headerCampaignId;
  }

  // Fallback for simple-sms-gateway: regex body for UUID
  if (provider === 'simple-sms-gateway' && body) {
    const bodyStr = JSON.stringify(body);
    const uuidRegex =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = bodyStr.match(uuidRegex);
    if (match) {
      logger.warn('Campaign ID extracted from message body', {
        provider,
        extractedCampaignId: match[0]
      });
      return match[0];
    }
  }

  return undefined;
}

export default extractCampaignId;
