import { parseHeader } from 'imap';
import ENV from '../config';
import { EXCLUDED_IMAP_FOLDERS } from '../utils/constants';
import { getMessageId } from '../utils/helpers/emailMessageHelpers';
import { hashEmail } from '../utils/helpers/hashHelpers';
import logger from '../utils/logger';
import redis from '../utils/redis';

const redisClient = redis.getClient();

/**
 * Publishes an email message to a Redis stream.
 * @param {string} streamName - The name of the Redis stream to publish to.
 * @param {number | null} fetchedMessagesCount - The number of messages fetched from the stream so far.
 * @param {object} emailMessage - The email message to publish.
 * @param {object} emailMessage.header - The email headers.
 * @param {object} emailMessage.body - The email body.
 * @param {number} emailMessage.seqNumber - The sequence number of the email in its folder.
 * @param {boolean} emailMessage.isLast - Whether this is the last message in the folder.
 * @param {string} emailMessage.userId - The user ID.
 * @param {string} emailMessage.userEmail - The user's email address.
 * @param {string} emailMessage.userIdentifier - The hashed user identifier.
 * @param {string} emailMessage.miningId - The ID of the mining process.
 * @returns {Promise<void>} A promise that resolves when the message is successfully published.
 */
async function publishEmailMessage(streamName, emailMessage) {
  try {
    await redisClient.xadd(
      streamName,
      '*',
      'message',
      JSON.stringify(emailMessage)
    );
  } catch (error) {
    logger.error(
      `Error when publishing email message to stream ${streamName}`,
      error
    );
    throw error;
  }
}

/**
 * Publishes the fetching progress for a mining task to redis PubSub.
 * @param {string} miningId - The ID of the mining job.
 * @param {number} fetchedMessagesCount - The number of messages fetched so far.
 * @returns {Promise<void>} - A Promise that resolves when the progress has been published.
 */
async function publishFetchingProgress(miningId, fetchedMessagesCount) {
  const progress = {
    miningId,
    count: fetchedMessagesCount,
    progressType: 'fetched'
  };

  // Publish a progress with how many messages we fetched.
  await redisClient.publish(miningId, JSON.stringify(progress));
}

class ImapEmailsFetcher {
  /**
   * Constructor for ImapEmailsFetcher.
   * @param {object} imapConnectionProvider - An instance of a configured IMAP connection provider.
   * @param {string[]} folders - List of folders to fetch.
   * @param {string} userId - The unique identifier of the user.
   * @param {string} userEmail - The email address of the user.
   * @param {string} miningId - The unique identifier of the mining process.
   * @param {string} streamName - The name of the stream to write fetched emails.
   * @param {number} [batchSize=50] - A Number To send notification every x emails processed
   */
  constructor(
    imapConnectionProvider,
    folders,
    userId,
    userEmail,
    miningId,
    streamName,
    batchSize = 50
  ) {
    // Used to send notification every x emails processed
    this.batchSize = batchSize;

    // Set the IMAP connection provider instance.
    this.imapConnectionProvider = imapConnectionProvider;

    // Set the list of folders to fetch.
    this.folders = folders;

    // Set the user details. Generate a unique identifier for the user.
    this.userId = userId;
    this.userEmail = userEmail;
    this.userIdentifier = hashEmail(userEmail, userId);

    this.streamName = streamName;
    this.miningId = miningId;

    // Set the key for the process set. used for caching.
    this.processSetKey = `caching:${miningId}`;
    this.fetchedIds = new Set();

    // Fetcher inner-state for total fetched messages.
    this.totalFetched = 0;

    this.bodies = ['HEADER'];

    if (ENV.IMAP_FETCH_BODY) {
      this.bodies.push('TEXT');
    }

    this.isCompleted = false;
    this.isCanceled = false;
  }

  /**
   * Fetches the total number of messages across the specified folders on an IMAP server.
   * @param {string[]} folderList - An array of folder names to fetch the total messages for.
   * @returns {Promise<number>} A Promise that resolves to the total number of messages across all folders.
   */
  async getTotalMessages() {
    let imapConnection = null;
    let error = null;
    let total = 0;

    try {
      imapConnection = await this.imapConnectionProvider.acquireConnection();

      // Create an array of Promises that resolve to the total number of messages in each folder.
      const folders = this.folders.filter(
        (folder) => !EXCLUDED_IMAP_FOLDERS.includes(folder)
      );
      const totalPromises = folders.map(
        (folder) =>
          new Promise((resolve, reject) => {
            // Opening a box will explicitly close the previously opened one if it exists.
            imapConnection.openBox(folder, true, (err, box) => {
              if (err) {
                reject(err);
              } else {
                resolve(box.messages.total);
              }
            });
          })
      );

      // Calculate the total number of messages across all folders.
      const totalArray = await Promise.all(totalPromises);

      for (const val of totalArray) {
        total += val;
      }

      // Close the last opened box.
      await new Promise((resolve, reject) => {
        imapConnection.closeBox((err) => {
          if (err) {
            logger.error('Error when closing box', error);
            reject(err);
          }
          resolve();
        });
      });
    } catch (err) {
      error = new Error(err);
    } finally {
      await this.imapConnectionProvider.releaseConnection(imapConnection);
    }

    if (error !== null) {
      // If an error occurred, throw it.
      throw error;
    }
    return total;
  }

  /**
   * Fetches all email messages in the configured boxes.
   * @returns {Promise}
   */
  async fetchEmailMessages() {
    const promises = this.folders.map(async (folderName) => {
      let imapConnection = {};

      if (EXCLUDED_IMAP_FOLDERS.includes(folderName)) {
        // Skip excluded folders
        return;
      }

      try {
        imapConnection = await this.imapConnectionProvider.acquireConnection();

        if (this.isCanceled) {
          // Kill pending promises before starting.
          await this.imapConnectionProvider.releaseConnection(imapConnection);
          return;
        }

        const openedBox = await new Promise((resolve, reject) => {
          imapConnection.openBox(folderName, true, (error, box) => {
            if (error) {
              logger.error('Error when opening folder', error);
              reject(new Error(error));
            }
            resolve(box);
          });
        });

        if (openedBox?.messages?.total > 0) {
          await this.fetchBox(
            imapConnection,
            folderName,
            openedBox.messages.total
          );
        }
      } catch (error) {
        logger.error('Error when fetching emails', error);
      } finally {
        // Close the mailbox and release the connection
        imapConnection.closeBox(async (error) => {
          if (error) {
            logger.error('Error when closing box', error);
          }
          await this.imapConnectionProvider.releaseConnection(imapConnection);
        });
      }
    });

    // Wait for all promises to settle before resolving the main promise
    this.process = Promise.allSettled(promises);
    await this.process;

    // Set the fetching status to completed and log message
    this.isCompleted = true;
    logger.info(`All fetch promises with ID ${this.miningId} are terminated.`);
  }

  /**
   *
   * @param {object} connection - Open IMAP connection.
   * @param {string} folderName - Name of the folder locked by the IMAP connection.
   * @param {number} totalInFolder - Total email messages in the folder.
   * @returns
   */
  fetchBox(connection, folderName, totalInFolder) {
    return new Promise((resolve, reject) => {
      const fetchResult = connection.seq.fetch('1:*', {
        bodies: this.bodies
      });

      let messageCounter = 0;

      fetchResult.on('message', (msg, seqNumber) => {
        let header = '';
        let body = '';

        if (this.isCanceled === true) {
          const message = `Canceled process on folder ${folderName} with ID ${this.miningId}`;
          reject(new Error(message));
          return;
        }

        msg.on('body', (stream, streamInfo) => {
          stream.on('data', (chunk) => {
            if (streamInfo.which.includes('HEADER')) {
              header += chunk;
            } else if (ENV.IMAP_FETCH_BODY) {
              body += chunk;
            }
          });
        });

        msg.once('end', async () => {
          const parsedHeader = parseHeader(header.toString('utf8'));
          const parsedBody = ENV.IMAP_FETCH_BODY ? body.toString('utf8') : '';

          const messageId = getMessageId(parsedHeader);

          parsedHeader['message-id'] = [messageId];

          const isLastMessageInFolder = seqNumber === totalInFolder;

          // To prevent loss of progress counter, check that the duplicated message is not the final one in the folder.
          if (this.fetchedIds.has(messageId) && !isLastMessageInFolder) {
            return;
          }

          this.fetchedIds.add(messageId);
          this.totalFetched += 1;

          const reachedBatchSize = messageCounter === this.batchSize;
          const shouldPublishProgress =
            reachedBatchSize || isLastMessageInFolder;
          const progressToSend = messageCounter + 1;
          // Increment the message counter or reset it to 0 if batch size has been reached.
          messageCounter = reachedBatchSize ? 0 : messageCounter + 1;

          if (shouldPublishProgress) {
            await publishFetchingProgress(this.miningId, progressToSend);
          }

          await publishEmailMessage(this.streamName, {
            header: parsedHeader,
            body: parsedBody,
            seqNumber,
            folderName,
            isLast: isLastMessageInFolder,
            userId: this.userId,
            userEmail: this.userEmail,
            userIdentifier: this.userIdentifier,
            miningId: this.miningId
          });
        });
      });

      fetchResult.once('error', (err) => {
        logger.error('IMAP fetch error', err);
        reject(err);
      });

      fetchResult.once('end', () => {
        resolve();
      });
    });
  }

  /**
   * Starts fetching email messages.
   * @returns {Object} This instance of the EmailFetcher class.
   */
  start() {
    return this.fetchEmailMessages();
  }

  /**
   * Performs cleanup operations after the fetching process has finished or stopped.
   * @returns {boolean}
   */
  async stop() {
    this.isCanceled = true;
    await this.process;
    await redisClient.unlink(this.processSetKey);
    await this.imapConnectionProvider.cleanPool(); // Do it async because it may take up to 30s to close
    return this.isCompleted;
  }
}

export default ImapEmailsFetcher;
