const hashHelpers = require('../utils/helpers/hashHelpers');
const Imap = require('imap');
const { IMAP_FETCH_BODY } = require('../config');
const logger = require('../utils/logger')(module);

class ImapEmailsFetcher {
  openConnections = [];

  /**
   * ImapEmailsFetcher constructor.
   * @param {object} imapConnectionProvider - A configured IMAP connection provider instance
   * @param {EventEmitter} eventEmitter - An event emitter
   * @param {string[]} folders - List of folders to fetch.
   * @param {string} userId - User Id.
   * @param {string} userEmail - User email.
   */
  constructor(
    imapConnectionProvider,
    eventEmitter,
    folders,
    userId,
    userEmail
  ) {
    this.imapConnectionProvider = imapConnectionProvider;
    this.eventEmitter = eventEmitter;
    this.folders = folders;
    this.userId = userId;
    this.userEmail = userEmail;
    this.userIdentifier = hashHelpers.hashEmail(userEmail, userId);

    this.eventEmitter.on('endByUser', () => {
      this.openConnections.forEach((connection) => connection.end());
    });

    this.fetchedMessagesCount = 0;

    this.bodies = ['HEADER'];
    if (IMAP_FETCH_BODY) {
      this.bodies.push('TEXT');
    }
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
   * @returns {Promise}
   */

  /**
   * Fetches all email messages in the configured boxes.
   * @param {emailMessageHandler} emailMessageHandler - A callback function to execute for each Email message.
   * @returns {Promise}
   */
  fetchEmailMessages(emailMessageHandler) {
    return Promise.allSettled(
      this.folders.map((folderName) => {
        return new Promise((resolve, reject) => {
          const imapConnection =
            this.imapConnectionProvider.getImapConnection();

          imapConnection.once('error', (err) => {
            logger.error('Imap connection error.', { error: err });
          });
          imapConnection.once('close', (hadError) => {
            logger.debug('Imap connection closed.', { hadError });
          });

          // We keep track of all the open imap connections so that we can close them when needed
          this.openConnections.push(imapConnection);

          imapConnection.once('ready', () => {
            imapConnection.openBox(folderName, true, async (err, box) => {
              if (err) {
                imapConnection.end();
                imapConnection.removeAllListeners();

                return reject(err);
              }
              if (box.messages?.total > 0) {
                await this.fetchBox(
                  imapConnection,
                  emailMessageHandler,
                  folderName,
                  box.messages.total
                );
              }

              // Close the connection and remove it from the list of openConnections
              imapConnection.end();
              imapConnection.removeAllListeners();
              this.openConnections = this.openConnections.filter(
                (connection) => connection._box?.name !== folderName
              );

              return resolve();
            });
          });

          imapConnection.connect();
        });
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
          const parsedBody = body.toString('utf8');

          this.fetchedMessagesCount++;

          await callback({
            header: parsedHeader,
            body: parsedBody,
            seqNumber,
            folderName,
            totalInFolder,
            progress: this.fetchedMessagesCount,
            userId: this.userId,
            userEmail: this.userEmail,
            userIdentifier: this.userIdentifier
          });
          msg.removeAllListeners();
        });
      });

      fetchResult.on('error', (err) => {
        logger.error(`Fetch error: ${err}`);
        fetchResult.removeAllListeners();
        reject(err);
      });

      fetchResult.once('end', () => {
        fetchResult.removeAllListeners();
        resolve();
      });
    });
  }
}

module.exports = {
  ImapEmailsFetcher
};
