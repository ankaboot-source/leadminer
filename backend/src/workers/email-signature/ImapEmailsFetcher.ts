import Connection, { Box, parseHeader } from 'imap';
import { EXCLUDED_IMAP_FOLDERS } from '../../utils/constants';
import { getMessageId } from '../../utils/helpers/emailHeaderHelpers';
import hashEmail from '../../utils/helpers/hashHelpers';
import logger from '../../utils/logger';
import redis from '../../utils/redis';
import ImapConnectionProvider from './ImapConnectionProvider';
import { EmailMessage } from './types';
import EmailSignatureCache from '../../services/cache/EmailSignatureCache';

const redisClient = redis.getClient();
const signatureCache = new EmailSignatureCache(redisClient);

/**
 * Publishes an email message to a Redis stream.
 * @param streamName - The name of the Redis stream to publish to.
 * @param emailMessage - The email message to publish.
 * @returns A promise that resolves when the message is successfully published.
 */
async function publishEmailMessage(
  streamName: string,
  emailMessage: EmailMessage
) {
  try {
    // Extract signature if body is present
    if (emailMessage.data.body) {
      const signature = extractSignature(emailMessage.data.body);
      if (signature) {
        const from = emailMessage.data.header.from?.[0] || '';
        await signatureCache.set(
          from,
          {
            signature,
            date: emailMessage.data.header.date?.[0] || new Date().toISOString()
          },
          emailMessage.data.header.date?.[0] || new Date().toISOString()
        );
      }
    }

    await redisClient.xadd(
      streamName,
      '*',
      'message',
      JSON.stringify(emailMessage)
    );
  } catch (error) {
    logger.error(
      `Error when publishing email message to stream ${streamName}`,
      error
    );
    throw error;
  }
}

/**
 * Extract email signature from email body
 * Simple implementation - can be improved based on specific needs
 */
function extractSignature(body: string): string | null {
  // Common signature markers
  const signatureMarkers = [
    '\n-- \n',
    '\nRegards,',
    '\nBest regards,',
    '\nKind regards,',
    '\nBest,',
    '\nCheers,',
    '\nSincerely,'
  ];

  for (const marker of signatureMarkers) {
    const index = body.lastIndexOf(marker);
    if (index !== -1) {
      const signature = body.slice(index).trim();
      // Basic validation - signatures shouldn't be too long
      if (signature.length < 1000) {
        return signature;
      }
    }
  }

  return null;
}

// ... rest of your original code stays exactly the same ...
