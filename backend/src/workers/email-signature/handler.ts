import { Logger } from 'winston';
import { Contacts } from '../../db/interfaces/Contacts';
import logger from '../../utils/logger';
import EmailSignatureCache from '../../services/cache/EmailSignatureCache';
import { Person } from '../../db/types';

export interface EmailSignature {
  signature: string;
  date: string;
}

export interface EmailSignatureData {
  userId: string;
  emailData: {
    messageId: string;
    messageDate: string;
    signature: string;
    from: string; // Email address of the sender
  };
}

class EmailSignatureProcessor {
  constructor(
    private readonly logs: Logger,
    private readonly contacts: Contacts,
    private readonly signatureCache: EmailSignatureCache
  ) {}

  async enrichContactDB(signature: Partial<Person>) {
    this.logs.debug(signature);
    return signature;
  }

  async extractSignature(signature: string): Promise<Partial<Person>> {
    this.logs.debug(signature);
    return {} as Partial<Person>;
  }

  /**
   * Processes a stream of email signature data
   * @param verificationData Array of email signature data to process
   * @returns Promise with all signatures if isLastEmail is true, otherwise void
   */
  async processStreamData(data: EmailSignatureData[]) {
    this.logs.info(`Processing ${data.length} email signatures`);
    const startTime = performance.now();

    try {
      const processingPromises = data.map(
        async ({ userId, emailData: { from, signature, messageDate } }) => {
          try {
            const isNewerSignature = await this.signatureCache.isNewer(
              userId,
              from,
              messageDate
            );

            if (!isNewerSignature) return;

            const contactData = await this.extractSignature(signature);
            await this.enrichContactDB(contactData);

            // Update signature in redis
            await this.signatureCache.set(userId, from, signature, messageDate);

            this.logs.info('Parsed/processed signature', {
              userId,
              signatureInfo: {
                signature,
                email: from,
                date: messageDate
              }
            });
          } catch (error) {
            this.logs.error('Error processing signature', {
              userId,
              email: from,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      );

      await Promise.allSettled(processingPromises);
    } catch (error) {
      this.logs.error('Fatal error in signature processing', {
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      });
      throw error;
    }
  }
}

export default function initializeEmailSignatureProcessor(
  contacts: Contacts,
  signatureCache: EmailSignatureCache
) {
  return {
    processStreamData: (data: EmailSignatureData[]) =>
      new EmailSignatureProcessor(
        logger,
        contacts,
        signatureCache
      ).processStreamData(data)
  };
}
