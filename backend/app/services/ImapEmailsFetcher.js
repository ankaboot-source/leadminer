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
    this.isCompleted = false;
    this.isCanceled = false;
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
    const folders = this.folders.filter(folderName => !EXCLUDED_IMAP_FOLDERS.includes(folderName));
    const promises = folders.map(async (folderName) => {
      let imapConnection = {};

      try {

        imapConnection = await this.imapConnectionProvider.acquireConnection();
        
        if (this.isCanceled) { // Kill pending promises before starting.
          await this.imapConnectionProvider.releaseConnection(imapConnection);
          return;
        }
        
        const openedBox = await new Promise((resolve, reject) => {
          imapConnection.openBox(folderName, true, (error, box) => {
            if (error) {
              logger.error('Error when opening folder', { metadata: { error } });
              reject(new Error(error));
            }
            resolve(box);
          });
        });
        
        if (openedBox?.messages?.total > 0) {
          await this.fetchBox(imapConnection, emailMessageHandler, folderName, openedBox.messages.total);
        }
      
      } catch (error) {
        logger.error('Error when fetching emails', { metadata: { error } });
     
      } finally {
        await imapConnection.closeBox(async (error) => {
          if (error) {
            logger.error('Error when closing box', { metadata: { error } });
          }
          await this.imapConnectionProvider.releaseConnection(imapConnection);
        });
      }
    });

    this.process = Promise.allSettled(promises)
      .then(() => {
        this.isCompleted = true;
        logger.info(`All fetch promises with ID ${this.miningId} are terminated.`);
      });
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

        if (this.isCanceled === true) {
          const message = `Terminating process on folder ${folderName} with ID ${this.miningId}`;
          reject(new Error(message));
          return;
        }

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
        reject(err);
      });

      fetchResult.once('end', () => {
        resolve();
      });
    });
  }

/**
 * Performs cleanup operations after the fetching process has finished or stopped.
 * @returns {boolean}
 */
async stop() {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  this.isCanceled = true;
  await this.process;
  await redisClient.unlink(this.processSetKey);
  this.imapConnectionProvider.cleanPool(); // Do it async because it may take up to 30s to close
  return this.isCompleted;
}


}

module.exports = {
  ImapEmailsFetcher
};
