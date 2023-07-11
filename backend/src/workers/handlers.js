import EmailMessage from '../services/extractors/EmailMessage';
import EmailTaggingEngine from '../services/tagging';
import logger from '../utils/logger';
import redis from '../utils/redis';

const redisClientForNormalMode = redis.getClient();

/**
 * Handles incoming email message and performs necessary operations like storing contact information,
 * populating refined_persons table and reporting progress.
 * @async
 * @function handleMessage
 * @param {Object} options - The options object.
 * @param {number} options.seqNumber - The sequence number of the email message.
 * @param {string} options.body - The body of the email message.
 * @param {string} options.header - The header of the email message.
 * @param {string} options.folderName - The name of the folder containing the email message.
 * @param {string} options.userId - The id of the user who received the email message.
 * @param {string} options.userEmail - The email of the user who received the email message.
 * @param {string} options.userIdentifierHash - The hash of the user's identifier.
 * @param {boolean} options.isLast - Indicates whether this is the last message in a sequence of messages.
 * @param {string} options.miningId - The id of the mining process.
 * @param {import('../db/Contacts').Contacts} contacts - The contacts db accessor.
 * @returns {Promise<void>}
 */
async function handleMessage(
  { body, header, folderName, userId, userEmail, userIdentifierHash, isLast },
  contacts
) {
  const message = new EmailMessage(
    EmailTaggingEngine,
    redisClientForNormalMode,
    userEmail,
    header,
    body,
    folderName
  );

  try {
    const extractedContacts = await message.getContacts();
    await contacts.create(extractedContacts, userId);

    if (isLast) {
      logger.info('Calling populate.', {
        metadata: {
          isLast,
          userHash: userIdentifierHash
        }
      });
      await contacts.populate(userId);
    }
  } catch (error) {
    logger.error(
      'Failed when processing message from the stream',
      error,
      userIdentifierHash
    );
  }
}

/**
 * Asynchronously processes a message from a Redis stream by parsing the data and passing it to the handleMessage function
 * @param {Array} message - Array containing the stream message ID and the message data
 */
export default function initializeMessageProcessor(contacts) {
  return {
    processStreamData: async (message) => {
      const [, msg] = message;
      const data = JSON.parse(msg[1]);
      const { miningId } = data;

      await handleMessage(data, contacts);
      return miningId;
    }
  };
}
