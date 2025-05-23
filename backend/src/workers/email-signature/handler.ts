import { Logger } from 'winston';
import { SupabaseClient } from '@supabase/supabase-js';
import EmailReplyParser from 'email-reply-parser';
import { findPhoneNumbersInText } from 'libphonenumber-js';
import { assert } from 'console';
import EmailSignatureCache from '../../services/cache/EmailSignatureCache';
import { Contact } from '../../db/types';
import logger from '../../utils/logger';

export interface EmailData {
  type: 'file' | 'email';
  userIdentifier: string;
  userId: string;
  userEmail: string;
  miningId: string;
  data: {
    header: {
      from: { address: string; name: string };
      messageID: string;
      messageDate: string;
    };
    body: string;
    isLast?: boolean;
  };
}

export class EmailSignatureProcessor {
  constructor(
    private readonly logging: Logger,
    private readonly supabase: SupabaseClient,
    private readonly cache: EmailSignatureCache
  ) {}

  public async process(data: EmailData): Promise<void> {
    const { userId, miningId, data: payload } = data;
    const { from, messageDate } = payload.header;

    this.logging.debug('process() start', {
      userId,
      miningId,
      from,
      messageDate
    });

    await this.handleNewSignature(
      userId,
      miningId,
      from.address,
      payload.body,
      messageDate
    );

    if (payload.isLast) {
      await this.handleBatchUpdate(userId, miningId);
    }
  }

  private async handleNewSignature(
    userId: string,
    miningId: string,
    email: string,
    body: string,
    messageDate: string
  ): Promise<void> {
    const isNew = await this.cache.isNewer(userId, email, messageDate);
    if (!isNew) {
      this.logging.info('Signature not newer than cached; skipping', {
        email,
        messageDate
      });
      return;
    }

    const signature = this.extractSignature(body);
    if (!signature) {
      this.logging.info('No signature found; skipping cache', {
        email,
        miningId
      });
      return;
    }

    await this.cache.set(userId, email, signature, messageDate, miningId);
    this.logging.info('Cached new signature', { email, miningId, messageDate });
  }

  private async handleBatchUpdate(
    userId: string,
    miningId: string
  ): Promise<void> {
    this.logging.debug('handleBatchUpdate()', { userId, miningId });

    const all = await this.cache.getAllFromMining(miningId);

    if (all.length === 0) {
      this.logging.info('No signatures to process for batch', { miningId });
      return;
    }

    await Promise.all(
      all.map(async ({ email, signature }) => {
        const contact = await this.extractContact(userId, email, signature);
        if (contact) {
          await this.upsertContact(contact);
        }
      })
    );

    await this.cache.clearCachedSignature(miningId);
    this.logging.info('Batch complete - cache cleared', {
      miningId,
      count: all.length
    });
  }

  private extractSignature(body: string): string | null {
    if (!body.trim()) return null;

    try {
      const parsed = new EmailReplyParser().read(body);
      const sigFrag = parsed.fragments.filter((f) => f.isSignature()).pop();
      return sigFrag?.getContent() ?? null;
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

    const phoneNumbers = findPhoneNumbersInText(signature);

    return {
      email,
      user_id: userId,
      telephone: phoneNumbers.map((phone) => phone.number.number)
    };
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
      telephone: contact.telephone?.join(','),
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
  cache: EmailSignatureCache
) {
  return {
    processStreamData: (data: EmailData) =>
      new EmailSignatureProcessor(logger, supabase, cache).process(data)
  };
}
