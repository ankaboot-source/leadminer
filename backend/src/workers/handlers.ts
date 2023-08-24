import { Queue } from 'bullmq';
import { Contacts } from '../db/interfaces/Contacts';
import EmailMessage from '../services/extractors/EmailMessage';
import EmailTaggingEngine from '../services/tagging';
import logger from '../utils/logger';
import redis from '../utils/redis';
import { checkDomainStatus } from '../utils/helpers/domainHelpers';

const redisClientForNormalMode = redis.getClient();

export interface PublishedStreamMessage {
  header: unknown;
  body: unknown;
  seqNumber: number;
  folderName: string;
  isLast: boolean;
  userId: string;
  userEmail: string;
  userIdentifier: string;
  miningId: string;
}

/**
 * Handles incoming email message and performs necessary operations like storing contact information,
 * populating refined_persons table and reporting progress.
 * @param options - The options object.
 * @param options.seqNumber - The sequence number of the email message.
 * @param options.body - The body of the email message.
 * @param options.header - The header of the email message.
 * @param options.folderName - The name of the folder containing the email message.
 * @param options.userId - The id of the user who received the email message.
 * @param options.userEmail - The email of the user who received the email message.
 * @param options.userIdentifier - The hash of the user's identifier.
 * @param options.isLast - Indicates whether this is the last message in a sequence of messages.
 * @param options.miningId - The id of the mining process.
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
  }: PublishedStreamMessage,
  contacts: Contacts,
  emailVerificationQueue: Queue
) {
  const message = new EmailMessage(
    EmailTaggingEngine,
    redisClientForNormalMode,
    emailVerificationQueue,
    checkDomainStatus,
    userEmail,
    userId,
    header,
    body,
    folderName
  );

  try {
    const extractedContacts = await message.getContacts();
    await contacts.create(extractedContacts, userId);
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
export default function initializeMessageProcessor(contacts: Contacts) {
  return {
    processStreamData: async (
      message: [string, string],
      emailVerificationQueue: Queue
    ) => {
      const [, msg] = message;
      const data: PublishedStreamMessage = JSON.parse(msg[1]);
      const { miningId } = data;

      await handleMessage(data, contacts, emailVerificationQueue);
      return miningId;
    }
  };
}
