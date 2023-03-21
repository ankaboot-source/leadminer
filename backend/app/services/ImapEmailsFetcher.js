const hashHelpers = require('../utils/helpers/hashHelpers');
const Imap = require('imap');
const { IMAP_FETCH_BODY } = require('../config');
const { logger } = require('../utils/logger');
const { redis } = require('../utils/redis');
const { EXCLUDED_IMAP_FOLDERS } = require('../utils/constants');
const redisClient = redis.getClient();

class ImapEmailsFetcher {
  /**
   * ImapEmailsFetcher constructor.
   * @param {object} imapConnectionProvider - A configured IMAP connection provider instance
   * @param {string[]} folders - List of folders to fetch.
   * @param {string} userId - User Id.
   * @param {string} userEmail - User email.
   * @param {string} miningId - The id of the mining process.
   */
  constructor(imapConnectionProvider, folders, userId, userEmail, miningId) {
    this.imapConnectionProvider = imapConnectionProvider;
    this.folders = folders;
    this.userId = userId;
    this.userEmail = userEmail;
    this.userIdentifier = hashHelpers.hashEmail(userEmail, userId);

    this.miningId = miningId;
    this.processSetKey = `caching:${miningId}`;

    this.fetchedIds = new Set();

    this.bodies = ['HEADER'];
    if (IMAP_FETCH_BODY) {
      this.bodies.push('TEXT');
    }
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
      const folders = this.folders.filter((folder) => !EXCLUDED_IMAP_FOLDERS.includes(folder));
      const totalPromises = folders.map((folder) => {
        return new Promise((resolve, reject) => {
          // Opening a box will explicitly close the previously opened one if it exists.
          imapConnection.openBox(folder, true, (err, box) => {
            if (err) {
              reject(err);
            } else {
              resolve(box.messages.total);
            }
          });
        });
      });

      // Calculate the total number of messages across all folders.
      const totalArray = await Promise.all(totalPromises);
      
      for (const val of totalArray) {
        total += val; 
      }

      // Close the last opened box.
      await new Promise((resolve, reject) => {
        imapConnection.closeBox(async (error) => {
          if (error) {
            logger.error('Error when closing box', { metadata: { details: error.message } });
            reject(error);
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
   * A callback function to execute for each Email message.
   * @callback emailMessageHandler
   * @param {object} emailMessage - An email message.
   * @param {object} emailMessage.header - Email headers.
   * @param {object} emailMessage.body - Email body.
   * @param {number} emailMessage.seqNumber - Email sequence number in its folder.
   * @param {number} emailMessage.totalInFolder - Total emails in folder.
   * @param {string} emailMessage.userId - User Id.
   * @param {string} emailMessage.userEmail - User email address.
   * @param {string} emailMessage.userIdentifier - Hashed user identifier
   * @param {string} emailMessage.miningId - The id of the mining process.
   * @returns {Promise}
   */

  /**
   * Fetches all email messages in the configured boxes.
   * @param {emailMessageHandler} emailMessageHandler - A callback function to execute for each Email message.
   * @returns {Promise}
   */
  fetchEmailMessages(emailMessageHandler) {
    return Promise.allSettled(
      this.folders.map(async (folderName) => {
        if (EXCLUDED_IMAP_FOLDERS.includes(folderName)) {
          return;
        }

        try {
          const imapConnection =
            await this.imapConnectionProvider.acquireConnection();

          imapConnection.openBox(folderName, true, async (err, box) => {
            if (err) {
              logger.error('Error when opening folder', { metadata: { err } });
            } else if (box.messages?.total > 0) {
              await this.fetchBox(
                imapConnection,
                emailMessageHandler,
                folderName,
                box.messages.total
              );
            }

            await this.imapConnectionProvider.releaseConnection(imapConnection);
          });
        } catch (error) {
          logger.error('Error when acquiring connection.', {
            metadata: { error }
          });
        }
      })
    );
  }

  /**
   *
   * @param {object} connection - Open IMAP connection.
   * @param {emailMessageHandler} callback
   * @param {string} folderName - Name of the folder locked by the IMAP connection.
   * @param {number} totalInFolder - Total email messages in the folder.
   * @returns
   */
  fetchBox(connection, callback, folderName, totalInFolder) {
    return new Promise((resolve, reject) => {
      const fetchResult = connection.seq.fetch('1:*', {
        bodies: this.bodies
      });

      fetchResult.on('message', (msg, seqNumber) => {
        let header = '';
        let body = '';

        msg.on('body', (stream, streamInfo) => {
          stream.on('data', (chunk) => {
            if (streamInfo.which.includes('HEADER')) {
              header += chunk;
            } else if (IMAP_FETCH_BODY) {
              body += chunk;
            }
          });
        });

        msg.once('end', async () => {
          const parsedHeader = Imap.parseHeader(header.toString('utf8'));
          const parsedBody = IMAP_FETCH_BODY ? body.toString('utf8') : '';

          let messageId = parsedHeader['message-id'];
          if (!messageId) {
            // We generate a pseudo message-id with the format
            // date@return_path_domain
            const returnPathDomain = parsedHeader['return-path'][0]
              .split('@')[1]
              .replace('>', '');
            const date =
              parsedHeader.date !== undefined
                ? Date.parse(parsedHeader.date[0])
                : '';
            messageId = `UNKNOWN ${date}@${returnPathDomain}`;
            parsedHeader['message-id'] = [messageId];
          } else {
            messageId = parsedHeader['message-id'][0];
          }

          if (this.fetchedIds.has(messageId)) {
            return;
          }

          this.fetchedIds.add(messageId);
          // We only increment the count for a message if it is
          // not duplicated and is published in the stream

          await callback({
            header: parsedHeader,
            body: parsedBody,
            seqNumber,
            folderName,
            totalInFolder,
            userId: this.userId,
            userEmail: this.userEmail,
            userIdentifier: this.userIdentifier,
            miningId: this.miningId
          });
        });
      });

      fetchResult.once('error', (err) => {
        logger.error('IMAP fetch error', { metadata: { err } });
        connection.closeBox(() => {
          reject(err);
        });
      });

      fetchResult.once('end', () => {
        connection.closeBox(() => {
          resolve();
        });
      });
    });
  }

  /**
   * Performs cleanup operations after we finished/stopped the fetching process.
   */
  async cleanup() {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await redisClient.unlink(this.processSetKey);
    await this.imapConnectionProvider.cleanPool();
  }
}

module.exports = {
  ImapEmailsFetcher
};
