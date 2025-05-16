import { Logger } from 'winston';
import { Contacts } from '../../db/interfaces/Contacts';
import logger from '../../utils/logger';
import EmailSignatureCache from '../../services/cache/EmailSignatureCache';
import { Contact, Person } from '../../db/types';
import { EmailFormat } from '../../services/extractors/engines/EmailMessage';
import PostalMime from 'postal-mime';
import EmailReplyParser from 'email-reply-parser';
import Enrichments from '../../db/supabase/enrichments';
import { SupabaseClient } from '@supabase/supabase-js';

export interface EmailData {
  /**
   * The hash of the userId
   */
  type: 'file' | 'email';
  userIdentifier: string;
  userId: string;
  userEmail: string;
  miningId: string;
  data: EmailFormat;
}

interface EmailHeader {
  from: {
    address: string;
    name: string;
  };
  messageID: string;
  messageDate: string;
}

class EmailSignatureProcessor {
  constructor(
    private readonly logs: Logger,
    private readonly supabaseClient: SupabaseClient,
    private readonly signatureCache: EmailSignatureCache
  ) {}

  async updateContacts(contact: Partial<Contact>) {
    const contactDB = {
      image: contact.image,
      email: contact.email,
      name: contact.name,
      job_title: contact.job_title,
      given_name: contact.given_name,
      family_name: contact.family_name,
      works_for: contact.works_for,
      same_as: contact.same_as?.join(','),
      location: contact.location?.join(','),
      alternate_name: contact.alternate_name?.join(','),
      user_id: contact.user_id
    };

    const { error } = await this.supabaseClient
      .schema('private')
      .rpc('enrich_contacts', {
        p_contacts_data: contactDB,
        p_update_empty_fields_only: true
      });

    if (error) throw error;
  }

  async getSignature(body: string): Promise<string | null> {
    if (!body) {
      this.logs.warn('Empty email body provided to getSignature');
      return null;
    }

    try {
      const email = new EmailReplyParser().read(body);
      const signatureFragment = email.fragments
        .filter((fragment) => fragment.isSignature())
        .pop();

      const signature = signatureFragment?.getContent() ?? null;

      console.log(body, signature, signatureFragment);

      this.logs.debug('Extracted signature from email body', signature);

      return signature;
    } catch (err) {
      this.logs.error('Error parsing email for signature', err);
      return null;
    }
  }

  async extractContactFromSignature(
    userId: string,
    contactEmail: string,
    signature: string
  ): Promise<Partial<Contact>> {
    this.logs.debug('Extracting contact from signature', signature);
    // Implementation to extract contact data goes here
    return {
      user_id: userId,
      email: contactEmail
    };
  }

  /**
   * Processes a stream of email signature data
   * @param data Email signature data to process
   */
  async processStreamData(data: EmailData) {
    const {
      userId,
      data: { header, body }
    } = data;

    const {
      from: { address, name },
      messageDate
    } = header as EmailHeader;

    if (!address) {
      this.logs.warn('Email from address missing', header);
      return;
    }

    try {
      this.logs.debug(
        'Processing stream data',
        userId,
        address,
        name,
        messageDate
      );

      const signature = await this.getSignature(body as string);
      if (!signature) {
        this.logs.info('No signature found in email body', address);
        return;
      }

      const isNewer = await this.signatureCache.isNewer(
        userId,
        address,
        messageDate
      );
      if (!isNewer) {
        this.logs.info(
          'Signature is not newer than cached one',
          address,
          messageDate
        );
        return;
      }

      const contactData = await this.extractContactFromSignature(
        userId,
        address,
        signature
      );

      if (!contactData) {
        this.logs.info('No contact data extracted from signature', signature);
        return;
      }

      await this.updateContacts(contactData);
      await this.signatureCache.set(userId, address, signature, messageDate);

      this.logs.info('Signature processed and cached', address);
    } catch (err) {
      this.logs.error('Error processing stream data', err, address, userId);
    }
  }
}

export default function initializeEmailSignatureProcessor(
  supabaseClient: SupabaseClient,
  signatureCache: EmailSignatureCache
) {
  return {
    processStreamData: (data: EmailData) =>
      new EmailSignatureProcessor(
        logger,
        supabaseClient,
        signatureCache
      ).processStreamData(data)
  };
}
