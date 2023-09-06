import { Contacts } from '../db/interfaces/Contacts';
import EmailStatusCache from '../services/cache/EmailStatusCache';
import EmailMessage from '../services/extractors/EmailMessage';
import EmailTaggingEngine from '../services/tagging';
import { checkDomainStatus } from '../utils/helpers/domainHelpers';
import logger from '../utils/logger';
import redis from '../utils/redis';

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
async function handleMessage(
  {
    body,
    header,
    folderName,
    userId,
    userEmail,
    userIdentifier
  }: EmailMessageData,
  contacts: Contacts,
  emailStatusCache: EmailStatusCache
) {
  const message = new EmailMessage(
    EmailTaggingEngine,
    redisClientForNormalMode,
    emailStatusCache,
    checkDomainStatus,
    userEmail,
    userId,
    header,
    body,
    folderName
  );

  try {
    const extractedContacts = await message.getContacts();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const emails = await contacts.create(extractedContacts, userId);
    // await emailVerificationQueue.addMany(
    //   emails.map((email) => ({ email, userId }))
    // );
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
  emailStatusCache: EmailStatusCache
) {
  return {
    processStreamData: async (message: EmailMessageData) =>
      handleMessage(message, contacts, emailStatusCache)
  };
}
