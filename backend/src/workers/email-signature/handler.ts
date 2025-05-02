import { Contacts } from '../../db/interfaces/Contacts';
import logger from '../../utils/logger';
import EmailSignatureCache, {
  EmailSignatureWithMetadata
} from '../../services/cache/EmailSignatureCache';

export interface EmailSignature {
  signature: string;
  date: string;
}

export interface EmailSignatureData {
  userId: string;
  miningId: string;
  emailData: {
    messageId: string;
    messageDate: string;
    signature: string;
    from: string; // Email address of the sender
  };
  isLastEmail: boolean;
}

function logRejectedAndReturnResolved<T>(
  results: PromiseSettledResult<T>[],
  context: string
): T[] {
  results
    .filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )
    .forEach((result) => {
      logger.error(`${context}: Promise rejected`, {
        error: result.reason,
        timestamp: new Date().toISOString()
      });
    });

  return results
    .filter(
      (result): result is PromiseFulfilledResult<T> =>
        result.status === 'fulfilled'
    )
    .map((result) => result.value);
}

class EmailSignatureProcessor {
  constructor(
    private contacts: Contacts,
    private signatureCache: EmailSignatureCache
  ) {}

  /**
   * Processes a stream of email signature data
   * @param verificationData Array of email signature data to process
   * @returns Promise with all signatures if isLastEmail is true, otherwise void
   */
  async processStreamData(data: EmailSignatureData[]) {
    logger.info(`Processing ${data.length} email signatures`);
    const startTime = performance.now();

    try {
      const processingPromises = data.map(async (signature) => {
        try {
          await this.processSingleSignature(signature);

          if (signature.isLastEmail) {
            const allSignatures = await this.signatureCache.getAllForMining(
              signature.miningId
            );
            logger.info(
              `Retrieved all signatures for mining ${signature.miningId}`,
              {
                count: allSignatures.length
              }
            );
          }
        } catch (error) {
          logger.error('Error processing signature', {
            userId: signature.userId,
            miningId: signature.miningId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      await Promise.allSettled(processingPromises);

      logger.info('Email signature processing completed', {
        duration: performance.now() - startTime,
        processedCount: data.length
      });
    } catch (error) {
      logger.error('Fatal error in signature processing', {
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Processes a single email signature
   * @param data Email signature data to process
   */
  private async processSingleSignature(
    data: EmailSignatureData
  ): Promise<void> {
    const { userId, miningId, emailData } = data;

    try {
      const existingSignature = await this.signatureCache.getMostRecent(
        emailData.from
      );

      if (existingSignature) {
        await this.handleExistingSignature(
          emailData.from,
          emailData,
          existingSignature
        );
      } else {
        await this.storeNewSignature(emailData.from, emailData);
      }

      logger.debug('Signature processed successfully', {
        email: emailData.from,
        miningId,
        messageId: emailData.messageId
      });
    } catch (error) {
      logger.error('Error in signature processing', {
        email: emailData.from,
        miningId,
        messageId: emailData.messageId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Handles case when signature already exists in cache
   */
  private async handleExistingSignature(
    email: string,
    emailData: EmailSignatureData['emailData'],
    existingSignature: EmailSignatureWithMetadata
  ): Promise<void> {
    if (emailData.messageDate > existingSignature.lastSeenDate) {
      await this.updateSignature(email, emailData);
    }
  }

  /**
   * Stores a new signature in cache
   */
  private async storeNewSignature(
    email: string,
    emailData: EmailSignatureData['emailData']
  ): Promise<void> {
    const signature: EmailSignature = {
      signature: emailData.signature,
      date: emailData.messageDate
    };

    await this.signatureCache.set(email, signature, emailData.messageDate);
  }

  /**
   * Updates an existing signature in cache
   */
  private async updateSignature(
    email: string,
    emailData: EmailSignatureData['emailData']
  ): Promise<void> {
    const updatedSignature: EmailSignature = {
      signature: emailData.signature,
      date: emailData.messageDate
    };

    await this.signatureCache.set(
      email,
      updatedSignature,
      emailData.messageDate
    );
  }
}

export default function initializeEmailSignatureProcessor(
  contacts: Contacts,
  signatureCache: EmailSignatureCache
) {
  return {
    processStreamData: (data: EmailSignatureData[]) =>
      new EmailSignatureProcessor(contacts, signatureCache).processStreamData(
        data
      )
  };
}
