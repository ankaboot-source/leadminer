import { PostgrestError } from '@supabase/supabase-js';
import { Contacts } from '../../db/interfaces/Contacts';
import CatchAllDomainsCache from '../../services/cache/CatchAllDomainsCache';
import EmailStatusCache from '../../services/cache/EmailStatusCache';
import QueuedEmailsCache from '../../services/cache/QueuedEmailsCache';
import EmailMessage from '../../services/extractors/EmailMessage';
import EmailTaggingEngine from '../../services/tagging';
import { checkDomainStatus } from '../../utils/helpers/domainHelpers';
import logger from '../../utils/logger';
import redis from '../../utils/redis';
import StreamProducer from '../../utils/streams/StreamProducer';
import { EmailVerificationData } from '../email-verification/emailVerificationHandlers';

const redisClientForNormalMode = redis.getClient();

export interface EmailMessageData {
  header: unknown;
  body: unknown;
  seqNumber: number;
  folderName: string;
  isLast: boolean;
  userId: string;
  userEmail: string;
  /**
   * The hash of the userId
   */
  userIdentifier: string;
  miningId: string;
}

/**
 * Handles incoming email message and performs necessary operations like storing contact information,
 * populating refined_persons table and reporting progress.
 * @param message - The message data.
 * @param contacts - The contacts db accessor.
 */
async function emailMessageHandler(
  {
    body,
    header,
    folderName,
    userId,
    userEmail,
    userIdentifier,
    miningId
  }: EmailMessageData,
  contacts: Contacts,
  emailStatusCache: EmailStatusCache,
  emailsStreamProducer: StreamProducer<EmailVerificationData>,
  queuedEmailsCache: QueuedEmailsCache,
  catchAllDomainsCache: CatchAllDomainsCache
) {
  const message = new EmailMessage(
    EmailTaggingEngine,
    redisClientForNormalMode,
    emailStatusCache,
    catchAllDomainsCache,
    checkDomainStatus,
    userEmail,
    userId,
    header,
    body,
    folderName
  );

  try {
    const extractedContacts = await message.getContacts();

    let emails: string[] = [];
    try {
      emails = (await contacts.create(extractedContacts, userId))
        .filter(
          // filter out unreachable emails
          (contact) =>
            !contact.tags.some(
              (tag) =>
                ['newsletter', 'role'].includes(tag.name) || tag.reachable >= 3
            )
        )
        .map((contact) => contact.email);
    } catch (e) {
      if ((e as PostgrestError).code === '23505') {
        // 23505: duplicate key error
        emails = (
          await contacts.getContacts(
            userId,
            extractedContacts.persons.map((contact) => contact.person.email)
          )
        )
          .filter(
            // filter out unreachable emails
            (contact) =>
              !contact.tags?.some(
                (tag) =>
                  ['newsletter', 'role'].includes(tag.name) ||
                  tag.reachable >= 3
              )
          )
          .map((contact) => contact.email);
      } else {
        throw e;
      }
    }
    if (emails.length > 0) {
      const input = (await queuedEmailsCache.addMany(emails)).addedElements.map(
        (e) => ({
          email: e,
          userId,
          miningId
        })
      );

      await emailsStreamProducer.produce(input);

      redisClientForNormalMode.publish(
        miningId,
        JSON.stringify({
          miningId,
          progressType: 'createdContacts',
          count: input.length
        })
      );
    }
  } catch (error) {
    logger.error(
      'Failed when processing message from the stream',
      error,
      userIdentifier
    );
  }
}

/**
 * Asynchronously processes a message from a Redis stream by parsing the data and passing it to the handleMessage function
 */
export default function initializeMessageProcessor(
  contacts: Contacts,
  emailStatusCache: EmailStatusCache,
  catchAllDomainsCache: CatchAllDomainsCache
) {
  return {
    processStreamData: (
      message: EmailMessageData,
      emailsStreamProducer: StreamProducer<EmailVerificationData>,
      queuedEmailsCache: QueuedEmailsCache
    ) =>
      emailMessageHandler(
        message,
        contacts,
        emailStatusCache,
        emailsStreamProducer,
        queuedEmailsCache,
        catchAllDomainsCache
      )
  };
}
