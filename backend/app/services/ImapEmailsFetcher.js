const { imapFetchBody } = require('../config/server.config');
const hashHelpers = require('../utils/helpers/hashHelpers');
const Imap = require('imap');
const logger = require('../utils/logger')(module);

class ImapEmailsFetcher {
  openConnections = [];

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
      this.openConnections.forEach((c) => c.end());
    });

    this.fetchedMessagesCount = 0;

    this.bodies = ['HEADER'];
    if (imapFetchBody === true) {
      this.bodies.push('TEXT');
    }
  }

  fetchEmailMessages(emailMessageHandler) {
    return Promise.allSettled(
      this.folders.map((folderName) => {
        return new Promise((resolve, reject) => {
          const imapConnection =
            this.imapConnectionProvider.getImapConnection();

          this.#registerImapConnectionHandlers(imapConnection);
          // We keep track of all the open imap connections so that we can close them when needed
          this.openConnections.push(imapConnection);

          imapConnection.once('ready', () => {
            imapConnection.openBox(folderName, true, async (err, box) => {
              if (err) {
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
              imapConnection.end();
              this.openConnections = this.openConnections.filter(
                (c) => c._box?.name !== folderName
              );
              resolve();
            });
          });

          imapConnection.connect();
        });
      })
    );
  }

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
            } else if (imapFetchBody) {
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
        });
      });

      fetchResult.on('error', (err) => {
        logger.error(`Fetch error: ${err}`);
        reject(err);
      });

      fetchResult.once('end', () => {
        resolve();
      });
    });
  }

  #registerImapConnectionHandlers(connection) {
    connection.once('error', (err) => {
      logger.error('Imap connection error.', { error: err });
    });

    connection.once('close', (hadError) => {
      logger.debug('Imap connection closed.', { hadError });
    });
  }
}

module.exports = {
  ImapEmailsFetcher
};
