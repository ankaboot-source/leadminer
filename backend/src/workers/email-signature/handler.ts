import { Logger } from 'winston';
import { SupabaseClient } from '@supabase/supabase-js';
import EmailReplyParser from 'email-reply-parser';
import { assert } from 'console';
import Redis from 'ioredis';
import PQueue from 'p-queue';
import planer from 'planer';
import EmailSignatureCache, {
  EmailSignatureWithMetadata
} from '../../services/cache/EmailSignatureCache';
import { Contact } from '../../db/types';
import loggerInstance from '../../utils/logger';
import {
  isUsefulSignatureContent,
  pushNotificationDB,
  upsertSignaturesDB
} from './utils';
import { ExtractSignature } from '../../services/signature/types';
import { DomainStatusVerificationFunction } from '../../services/extractors/engines/EmailMessage';
import { CleanQuotedForwardedReplies } from '../../utils/helpers/emailParsers';
import EmailTaggingEngine from '../../services/tagging';
import { REACHABILITY } from '../../utils/constants';

// Constants
const MAX_QUEUE_SIZE = 1000;
const DRAIN_THRESHOLD = 700;
const MAX_RETRIES = 10;

// Types
export interface EmailData {
  type: 'email';
  userIdentifier: string;
  userId: string;
  userEmail: string;
  miningId: string;
  data: {
    header: {
      rawHeader: Record<string, string[]>;
      from: { address: string; name: string };
      messageID: string;
      messageDate: string;
    };
    body: string;
    isLast?: boolean;
    totalSignatures?: number;
    retryCount?: number;
  };
}

const IGNORED_TAGS: ReadonlyArray<string> = [
  'transactional',
  'no-reply'
] as const;

/**
 * Handles email signature extraction and processing
 * Uses a persistent queue for concurrent processing with backpressure
 */
export class EmailSignatureHandler {
  private readonly queue: PQueue;

  private readonly streamProgressDelta = new Map<string, number>();

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly signature: ExtractSignature,
    private readonly cache: EmailSignatureCache,
    private readonly domainStatusVerification: DomainStatusVerificationFunction,
    private readonly redisClient: Redis,
    private readonly logger: Logger
  ) {
    this.queue = new PQueue({
      concurrency: 5,
      interval: 10,
      intervalCap: 1
    });
  }

  /**
   * Main entry point - processes a batch of email messages
   * Called by the consumer for each batch from the stream
   */
  public async handle(
    signatureStream: string,
    messages: EmailData[]
  ): Promise<void> {
    for (const message of messages) {
      // eslint-disable-next-line no-await-in-loop
      await this.applyBackpressure();
      // eslint-disable-next-line no-await-in-loop
      await this.processMessage(signatureStream, message);
    }
  }

  /**
   * Processes a single email message
   */
  private async processMessage(
    signatureStream: string,
    data: EmailData
  ): Promise<void> {
    try {
      const { miningId, data: payload } = data;
      const { totalSignatures = 0, retryCount = 0 } = payload;

      if (data.data.isLast) {
        const { received } = await this.cache.getProgress(miningId);

        // return if max retries is reached
        if (retryCount >= MAX_RETRIES) {
          this.logger.error('Max retries reached for batch processing', {
            miningId,
            retryCount
          });
          return;
        }

        // if processed < total signature, publish message again to stream
        if (received < totalSignatures) {
          this.logger.debug('Re-adding last payload to stream', {
            miningId,
            retryCount: retryCount + 1
          });

          await this.redisClient.xadd(
            signatureStream,
            '*',
            'message',
            JSON.stringify({
              ...data,
              data: { ...data.data, retryCount: retryCount + 1 }
            })
          );
          return;
        }
      }

      const shouldProcess = await this.isWorthProcessing(data);

      if (shouldProcess) {
        await this.handleNewSignature(data);
      }

      if (data.data.isLast) {
        await this.handleLastPayload(data);
      }
    } catch (err) {
      const {
        data: { isLast },
        miningId
      } = data;

      if (isLast) {
        this.logger.error(
          'Signature processing failed on final payload — forcing completion',
          {
            miningId,
            isLast,
            error: err
          }
        );

        await this.completed(miningId);
      } else {
        this.logger.error('Signature processing failed', {
          miningId,
          isLast,
          error: err
        });
      }
    } finally {
      const { miningId } = data;
      await this.cache.incrementReceived(miningId);
    }
  }

  /**
   * Determines if an email is worth processing for signatures
   */
  private async isWorthProcessing(data: EmailData): Promise<boolean> {
    const { data: payload } = data;
    const { from, messageDate, rawHeader } = payload.header ?? {};
    const [, domain] = from?.address?.split('@') || [];

    if (!from || !messageDate || !domain) return false;

    const [domainIsValid, domainType] = await this.domainStatusVerification(
      this.redisClient,
      domain.toLowerCase()
    );

    if (!domainIsValid) return false;

    const tags = EmailTaggingEngine.getTags({
      header: rawHeader,
      email: { address: from.address, name: from.name, domainType },
      field: 'from'
    });

    return (
      !tags.some((t) => IGNORED_TAGS.includes(t.name)) &&
      tags.some((t) => t.reachable === REACHABILITY.DIRECT_PERSON)
    );
  }

  /**
   * Caches a new signature if it's useful and newer than existing
   */
  private async handleNewSignature(data: EmailData): Promise<void> {
    const { userId, miningId, data: payload } = data;
    const { from, messageDate, rawHeader } = payload.header ?? {};
    const [messageId] = rawHeader['message-id'];
    const { body } = payload;
    const email = from?.address;

    if (!email) return;

    const signature = this.extractSignature(body);

    if (!signature || !isUsefulSignatureContent(signature)) {
      this.logger.info('No useful signature found; skipping cache', {
        email,
        miningId
      });
      return;
    }

    const isNew = await this.cache.isNewer(userId, email, messageDate);
    if (!isNew) {
      this.logger.info('Signature not newer than cached; skipping', {
        email,
        messageDate
      });
      return;
    }

    await this.cache.set(
      userId,
      email,
      signature,
      messageId,
      messageDate,
      miningId
    );

    this.logger.debug('Cached new signature', {
      email,
      miningId,
      messageDate
    });
  }

  /**
   * Extracts signature from email body
   */
  private extractSignature(body: string): string | null {
    if (!body.trim()) return null;

    try {
      const text = planer.extractFrom(body, 'text/plain');
      const originalMessage = CleanQuotedForwardedReplies(text);
      const parsed = new EmailReplyParser().read(originalMessage);
      const sigFrag = parsed.fragments.filter((f) => f.isSignature()).pop();

      return (
        sigFrag?.getContent() ??
        originalMessage
          .trim()
          .split('\n')
          .filter((l) => l.trim())
          .slice(-6)
          .join('\n')
      );
    } catch (err) {
      this.logger.error('Failed to parse email body for signature', err);
      return null;
    }
  }

  /**
   * Handles the last payload - coordinates batch processing across workers
   */
  private async handleLastPayload(data: EmailData) {
    const { miningId, userId } = data;
    const signatures = await this.cache.getAllFromMining(miningId);

    if (signatures.length === 0) {
      this.logger.info('No signatures to process for batch', { miningId });
      return;
    }

    this.logger.info('Queueing signatures for processing', {
      miningId,
      count: signatures.length
    });

    const lastSignature = signatures.pop() as EmailSignatureWithMetadata;

    signatures.forEach((sig) => {
      this.queue.add(
        async () => {
          const progress = this.streamProgressDelta.get(miningId) ?? 0;
          try {
            await this.processSignatureJob(miningId, userId, sig);
            this.streamProgressDelta.set(miningId, progress + 1);
          } catch (error) {
            this.logger.error('Failed to process signature job', {
              error
            });
          }
        },
        { priority: 1 }
      );
    });

    this.queue.add(async () => {
      const progress = this.streamProgressDelta.get(miningId) ?? 0;
      try {
        await this.processSignatureJob(miningId, userId, lastSignature);
        this.streamProgressDelta.set(miningId, progress + 1);
      } catch (error) {
        this.logger.error('Failed to process signature job', {
          error
        });
      } finally {
        await pushNotificationDB(this.supabase, {
          userId,
          type: 'signature',
          details: {
            signatures: progress
          }
        });
        await this.completed(miningId);
      }
    });
  }

  /**
   * Processes a single signature job
   */
  private async processSignatureJob(
    miningId: string,
    userId: string,
    sig: {
      email: string;
      signature: string;
      messageId: string;
    }
  ): Promise<void> {
    try {
      const contact = await this.extractContact(
        userId,
        sig.email,
        sig.signature
      );

      if (contact) {
        await this.upsertContact(contact);
        await upsertSignaturesDB(this.supabase, [
          {
            userId,
            personEmail: sig.email,
            messageId: sig.messageId,
            rawSignature: sig.signature,
            extractedSignature: contact,
            details: { miningId }
          }
        ]);
      }
    } catch (err) {
      this.logger.error('Signature job failed', {
        miningId,
        email: sig.email,
        error: (err as Error).message
      });
    }
  }

  /**
   * Extracts contact information from signature
   */
  private async extractContact(
    userId: string,
    email: string,
    signature: string
  ): Promise<Partial<Contact> | null> {
    const contact = await this.signature.extract(email, signature);
    if (!contact) return null;

    const enrichedContact: Partial<Contact> = {
      email,
      user_id: userId,
      image: contact.image,
      location: contact.address,
      telephone: contact.telephone,
      job_title: contact.jobTitle,
      works_for: contact.worksFor,
      same_as: contact.sameAs
    };

    // Check if anything beyond email and user_id is present
    const hasExtraInfo = Object.entries(enrichedContact).some(
      ([key, value]) => !['email', 'user_id'].includes(key) && value
    );

    return hasExtraInfo ? enrichedContact : null;
  }

  /**
   * Upsert contact to database
   */
  private async upsertContact(contact: Partial<Contact>): Promise<void> {
    assert(contact.user_id, "upsertContact: 'user_id' is required");

    const payload = {
      name: contact.name ?? null,
      image: contact.image ?? null,
      email: contact.email,
      job_title: contact.job_title ?? null,
      given_name: contact.given_name ?? null,
      family_name: contact.family_name ?? null,
      works_for: contact.works_for ?? null,
      same_as: (contact.same_as ?? []).join(','),
      location: contact.location ?? null,
      alternate_name: contact.alternate_name ?? null,
      telephone: Array.isArray(contact.telephone)
        ? contact.telephone.join(',')
        : [contact.telephone].join(','),
      user_id: contact.user_id
    };

    const { error } = await this.supabase
      .schema('private')
      .rpc('enrich_contacts', {
        p_contacts_data: [payload],
        p_update_empty_fields_only: false
      });

    if (error) throw error;
  }

  /**
   * Applies backpressure when queue is full
   */
  private async applyBackpressure(): Promise<void> {
    if (this.queue.size < MAX_QUEUE_SIZE) return;

    this.logger.debug('Queue limit reached, applying backpressure', {
      currentSize: this.queue.size,
      limit: MAX_QUEUE_SIZE,
      threshold: DRAIN_THRESHOLD
    });

    const startTime = performance.now();
    await this.queue.onSizeLessThan(DRAIN_THRESHOLD);

    const duration = performance.now() - startTime;
    this.logger.debug('Backpressure released', {
      durationMs: duration.toFixed(2),
      newSize: this.queue.size
    });
  }

  /**
   * Cleans up cached signatures and progress tracking
   */
  private async completed(miningId: string): Promise<void> {
    const progress = this.streamProgressDelta.get(miningId) ?? 0;
    this.streamProgressDelta.delete(miningId);
    await this.publishCompletion(miningId, progress, false);
    await this.cache.clearCachedSignature(miningId);
    await this.cache.clearProgress(miningId);
  }

  /**
   * Publishes final completion notification
   */
  private async publishCompletion(
    miningId: string,
    count: number,
    failed: boolean
  ): Promise<void> {
    // Publish to Redis
    this.redisClient
      .publish(
        miningId,
        JSON.stringify({
          miningId,
          progressType: 'signatures',
          isCompleted: !failed,
          count,
          failed
        })
      )
      .catch((err) => {
        this.logger.error('Failed to publish completion', {
          miningId,
          error: err
        });
      });
  }
}

/**
 * Factory function to create handler instance
 * Maintains backward compatibility with existing worker initialization
 */
export default function initializeEmailSignatureProcessor(
  supabase: SupabaseClient,
  signature: ExtractSignature,
  cache: EmailSignatureCache,
  domainStatusVerification: DomainStatusVerificationFunction,
  redisClient: Redis
) {
  const handler = new EmailSignatureHandler(
    supabase,
    signature,
    cache,
    domainStatusVerification,
    redisClient,
    loggerInstance
  );

  return {
    /**
     * Process a single message (backward compatibility)
     * Wraps single message in array for batch processing
     */
    processStreamData: async (data: EmailData) =>
      // await handler.handle([data]);
      // Return format expected by existing consumer
      ({
        finished: data.data.isLast || false,
        contacts: []
      }),
    /**
     * Direct access to handler for batch processing
     */
    handler
  };
}
