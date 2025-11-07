import { Logger } from 'winston';
import { SupabaseClient } from '@supabase/supabase-js';
import EmailReplyParser from 'email-reply-parser';
import { assert } from 'console';
import Redis from 'ioredis';
import planer from 'planer';
import EmailSignatureCache from '../../services/cache/EmailSignatureCache';
import { Contact } from '../../db/types';
import logger from '../../utils/logger';
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
  };
}

const IGNORED_TAGS: ReadonlyArray<string> = [
  'transactional',
  'no-reply'
] as const;

export class EmailSignatureProcessor {
  constructor(
    private readonly logging: Logger,
    private readonly supabase: SupabaseClient,
    private readonly signature: ExtractSignature,
    private readonly cache: EmailSignatureCache,
    private readonly domainStatusVerification: DomainStatusVerificationFunction,
    private readonly redisClient: Redis
  ) {}

  private async isWorthProcessing(data: EmailData) {
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

    // Eliminate unwanted contacts associated with tags listed in IGNORED_MESSAGE_TAGS
    return (
      !tags.some((t) => IGNORED_TAGS.includes(t.name)) &&
      tags.some((t) => t.reachable === REACHABILITY.DIRECT_PERSON)
    );
  }

  public async process(data: EmailData): Promise<{
    finished: boolean;
    contacts: Partial<Contact>[] | null;
  }> {
    const { userId, miningId, data: payload } = data;
    const { from, messageDate, rawHeader } = payload.header ?? {};

    const shouldProcess = await this.isWorthProcessing(data);

    if (shouldProcess) {
      const [messageId] = rawHeader['message-id'];

      this.logging.debug('Processing new signature', {
        userId,
        miningId,
        from,
        messageDate
      });

      await this.handleNewSignature(
        userId,
        miningId,
        from?.address,
        payload.body,
        messageId,
        messageDate
      );
    }

    if (!payload.isLast)
      return {
        finished: false,
        contacts: []
      };

    const extracted = await this.handleBatchUpdate(userId, miningId);

    if (extracted.length) {
      try {
        const signatures = extracted.map(
          ([personEmail, messageId, rawSignature, extractedSignature]) => ({
            userId,
            personEmail,
            messageId,
            rawSignature,
            extractedSignature,
            details: { miningId }
          })
        );

        await upsertSignaturesDB(this.supabase, signatures);

        await pushNotificationDB(this.supabase, {
          userId,
          type: 'signature',
          details: {
            signatures: extracted.length
          }
        });
      } catch (err) {
        this.logging.error(
          `Error when inserting signatures/notifications: ${(err as Error).message}`,
          err
        );
      }
    }
    return {
      finished: true,
      contacts: extracted.map(([, , , contact]) => contact)
    };
  }

  private async handleNewSignature(
    userId: string,
    miningId: string,
    email: string,
    body: string,
    messageId: string,
    messageDate: string
  ): Promise<void> {
    const signature = this.extractSignature(body);

    if (!signature || !isUsefulSignatureContent(signature)) {
      this.logging.info('No signature found; skipping cache', {
        email,
        body: signature,
        miningId
      });
      return;
    }

    const isNew = await this.cache.isNewer(userId, email, messageDate);
    if (!isNew) {
      this.logging.info('Signature not newer than cached; skipping', {
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
    this.logging.info('Cached new signature', {
      email,
      miningId,
      messageDate,
      signature
    });
  }

  private async handleBatchUpdate(
    userId: string,
    miningId: string
  ): Promise<[string, string, string, Partial<Contact>][]> {
    this.logging.debug('handleBatchUpdate()', { userId, miningId });

    const all = await this.cache.getAllFromMining(miningId);

    if (all.length === 0) {
      this.logging.info('No signatures to process for batch', { miningId });
      return [];
    }

    const contacts: ([string, string, string, Partial<Contact>] | undefined)[] =
      await Promise.all(
        all.map(async ({ email, signature, messageId }) => {
          try {
            const contact = await this.extractContact(userId, email, signature);
            if (contact) {
              await this.upsertContact(contact);
              return [email, messageId, signature, contact];
            }
            return undefined;
          } catch (err) {
            this.logging.error('Error on extract/insert contact', err);
            return undefined;
          }
        })
      );

    await this.cache.clearCachedSignature(miningId);

    const successfulContacts = contacts.filter((c) => c && contacts.length) as [
      string,
      string,
      string,
      Partial<Contact>
    ][];

    this.logging.info('Batch complete - cache cleared', {
      miningId,
      processed: all.length,
      successful: successfulContacts.length
    });

    return successfulContacts;
  }

  private extractSignature(body: string): string | null {
    if (!body.trim()) return null;

    try {
      // Clean email body from quoted replies
      const text = planer.extractFrom(body, 'text/plain');
      // Double-Clean to handle special cases and forwarded messages
      const originalMessage = CleanQuotedForwardedReplies(text);
      const parsed = new EmailReplyParser().read(originalMessage);
      const sigFrag = parsed.fragments.filter((f) => f.isSignature()).pop();
      return (
        sigFrag?.getContent() ??
        originalMessage
          .trim()
          .split('\n')
          .filter((l) => l.trim())
          .slice(-4)
          .join('\n')
      );
    } catch (err) {
      this.logging.error('Failed to parse email body for signature', err);
      return null;
    }
  }

  private async extractContact(
    userId: string,
    email: string,
    signature: string
  ): Promise<Partial<Contact> | null> {
    this.logging.debug('extractContact()', { email, signature });

    const contact = await this.signature.extract(signature);
    if (!contact) return null;

    const enrichedContact: Partial<Contact> = {
      email,
      user_id: userId,
      name: contact.name,
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

  private async upsertContact(contact: Partial<Contact>): Promise<void> {
    assert(contact.user_id, "upsertContact: 'user_id' is required");
    const payload = {
      image: contact.image ?? null,
      email: contact.email,
      name: contact.name ?? null,
      job_title: contact.job_title ?? null,
      given_name: contact.given_name ?? null,
      family_name: contact.family_name ?? null,
      works_for: contact.works_for ?? null,
      same_as: (contact.same_as ?? []).join(','),
      location: (contact.location ?? []).join(','),
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
}

export default function initializeEmailSignatureProcessor(
  supabase: SupabaseClient,
  signature: ExtractSignature,
  cache: EmailSignatureCache,
  domainStatusVerification: DomainStatusVerificationFunction,
  redisClient: Redis
) {
  return {
    processStreamData: (data: EmailData) =>
      new EmailSignatureProcessor(
        logger,
        supabase,
        signature,
        cache,
        domainStatusVerification,
        redisClient
      ).process(data)
  };
}
