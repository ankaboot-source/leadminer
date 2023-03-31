const { db } = require('../db');
const EmailMessage = require('../services/EmailMessage');
const { redis } = require('../utils/redis');
const redisClientForNormalMode = redis.getClient();
const { logger } = require('../utils/logger');

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
 * @returns {Promise<void>}
 */
async function handleMessage({
    seqNumber,
    body,
    header,
    folderName,
    userId,
    userEmail,
    userIdentifierHash,
    isLast
}) {
    const message = new EmailMessage(
        redisClientForNormalMode,
        userEmail,
        seqNumber,
        header,
        body,
        folderName
    );

    const extractedContacts = await message.extractEmailAddresses();
    await db.store(extractedContacts, userId);

    if (isLast) {
        try {
            logger.info('Calling populate.', {
                metadata: {
                    isLast,
                    userHash: userIdentifierHash
                }
            });
            await db.callRpcFunction(userId, 'populate_refined');
        } catch (error) {
            logger.error('Failed populating refined_persons.', {
                metadata: {
                    error,
                    userHash: userIdentifierHash
                }
            });
        }
    }
}

/**
 * Asynchronously processes a message from a Redis stream by parsing the data and passing it to the handleMessage function
 * @param {Array} message - Array containing the stream message ID and the message data
 */
const processStreamData = async (message) => {
    const [, msg] = message;
    const data = JSON.parse(msg[1]);
    const { miningId } = data;

    await handleMessage(data);
    return miningId;
};

module.exports = {
    processStreamData,
    handleMessage
};
