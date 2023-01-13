const imapTreeHelpers = require('../utils/helpers/imapTreeHelpers');
const inputHelpers = require('../utils/helpers/inputHelpers');
const Imap = require('imap');
const logger = require('../utils/logger')(module);
const { redis } = require('../utils/redis');
const redisClientForPubSubMode = redis.getPubSubClient();

const { db } = require('../db');
const { imapFetchBody } = require('../config/server.config');
const { REDIS_MESSAGES_CHANNEL } = require('../utils/constants');

class EmailAccountMiner {
  /**
   * EmailAccountMiner constructor.
   * @param {object} connection - The connection to the IMAP server.
   * @param {object} user - The user object that is currently associated with the connection.
   * @param {object} sse - The SSE object that will be used to send the data to the client.
   * @param {string[]} folders - An array of folder paths to fetch from.
   * @param {EventEmitter} eventEmitter
   */
  constructor(connection, user, sse, folders, eventEmitter) {
    this.connection = connection;
    this.user = user;
    this.sse = sse;
    this.folders = folders;
    this.eventEmitter = eventEmitter;

    this.fetchedMessagesCount = 0;
    this.tree = [];
    this.sends = [];
    this.emailsProgressIndexes = [];
    this.fetchedBoxes = [];
  }

  /**
   * getTree connects to the IMAP server, gets the tree of folders, adds the total number of emails per
   * folder, and then adds the total number of emails per parent folder
   * @returns a promise that resolves to an array of two elements. The first element is the tree object,
   * the second element is an error object.
   */
  getTree() {
    // eslint-disable-next-line no-warning-comments
    // TODO - Rework tree parsing algorithm
    return new Promise((resolve) => {
      performance.mark('fetchBoxes-start');
      let result = [];
      this.connection.connect().then((connection) => {
        this.connection = connection;
        this.connection.once('ready', () => {
          logger.info('Started fetching folders tree for user.', {
            user: this.user.userIdentifierHash
          });
          this.connection.getBoxes('', async (err, boxes) => {
            if (err) {
              result = [this.tree, err];
              resolve(result);
            }
            // extract All folders with their parents and path
            const treeWithPaths = imapTreeHelpers.createFlatTreeFromImap(boxes);
            // add total to each folder
            await this.AddTotalPerFolder(treeWithPaths);
            this.tree = imapTreeHelpers.buildFinalTree(
              treeWithPaths,
              this.user.email
            );
            this.connection.end();
          });
        });

        this.connection.once('close', () => {
          logger.info('Finished mining folders tree for user.', {
            user: this.user.userIdentifierHash,
            duration: performance.measure('fetch folders', 'fetchBoxes-start')
              .duration
          });
          result = [this.tree, null];
          resolve(result);
        });

        this.connection.once('error', (error) => {
          logger.error('Failed to get IMAP Tree', {
            error,
            userId: this.user.id
          });
          result = [this.tree, error];
          resolve(result);
        });
      });
    });
  }

  /**
   * AddTotalPerFolder Gets the total number of messages per folder
   * @param {{label: string, path: string}[]} folders - flat array of objects.
   * @returns {Promise} A promise that resolves to the folders with the total number of messages.
   */
  AddTotalPerFolder(folders) {
    const promises = folders.map((folder) => {
      return new Promise((resolve, reject) => {
        this.connection.openBox(folder.path, true, (err, box) => {
          if (err) {
            reject(err);
          }
          if (box) {
            folder.total = box.messages.total;
            folder.cumulativeTotal = box.messages.total;
          } else {
            folder.total = 0;
            folder.cumulativeTotal = 0;
          }
          resolve();
        });
      });
    });
    return Promise.allSettled(promises);
  }

  /**
   * Initiates the fetching process using IMAP.
   */
  async mine() {
    // init the connection using the user info (name, host, port, password, token...)
    this.connection.initConnection();
    this.connection = await this.connection.connect();

    this.connection.once('ready', () => {
      performance.mark('fetching-start');
      logger.info('Started fetching email messages for user.', {
        user: this.user.userIdentifierHash
      });
      this.fetchFolder(this.folders[0]).next();
    });

    // Request canceled from client.
    this.eventEmitter.on('endByUser', () => {
      this.connection.end();
      logger.info('Connection to IMAP server destroyed by user.', {
        user: this.user.userIdentifierHash
      });
    });

    // IMAP Connection error.
    this.connection.on('error', (err) => {
      logger.error('Error with IMAP connection.', { error: err });
      this.eventEmitter.emit('error');
    });

    // IMAP Connection closed.
    this.connection.once('close', () => {
      logger.info('Finished collecting emails for user.', {
        user: this.user.userIdentifierHash,
        duration: performance.measure('measure fetching', 'fetching-start')
          .duration
      });

      this.sse.send(true, 'data');
      this.sse.send(true, `dns${this.user.id}`);
      this.eventEmitter.emit('end', true);
    });
  }

  /**
   * A generator function that opens an IMAP folder, and when it's done, it mines the messages in that folder
   * and loops through all selected folders
   * @param {string} folderName - The folder you want to mine.
   */
  *fetchFolder(folderName) {
    yield this.connection.openBox(folderName, true, (err, openedFolder) => {
      if (err) {
        logger.error(
          `Error occurred when opening folder ${folderName} for User: ${this.user.userIdentifierHash}`,
          { error: err }
        );
      }
      this.fetchMessages({
        folderName,
        totalMessages: openedFolder ? openedFolder.messages.total : 0
      });
    });
  }

  /**
   * mineMessages takes a folder name as an argument,and calls the fetching method.
   * @param {object} folder - The folder to mine.
   */
  fetchMessages({ folderName, totalMessages }) {
    if (totalMessages > 0) {
      this.sends = inputHelpers.EqualPartsForSocket(totalMessages, 'position');
      this.emailsProgressIndexes = inputHelpers.EqualPartsForSocket(
        totalMessages,
        'data'
      );
      this.ImapFetch({ folderName, totalMessages });
    } else if (this.folders.indexOf(folderName) + 1 === this.folders.length) {
      this.connection.end();
    } else {
      // if this folder is just a label then pass to the next folder
      this.fetchFolder(
        this.folders[this.folders.indexOf(folderName) + 1]
      ).next();
    }
  }

  /**
   * Fetches all the messages from a folder and publishes them to Redis.
   * @param {object} folder - the folder object
   */
  ImapFetch({ folderName, totalMessages }) {
    const bodies = ['HEADER'];
    if (imapFetchBody === true) {
      bodies.push('TEXT');
    }

    const fetchResult = this.connection.seq.fetch('1:*', {
      bodies
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

        if (this.shouldSendFetchingProgress(seqNumber)) {
          this.sendFetchingProgress();
        }

        if (this.shouldPopulateRefinedPersons(seqNumber)) {
          await this.sendMinedData();
        }

        await this.publishMessageToChannel(
          seqNumber,
          parsedHeader,
          parsedBody,
          folderName,
          seqNumber === totalMessages
        );
      });
    });

    fetchResult.on('error', (err) => {
      logger.error(`Fetch error: ${err}`);
    });

    fetchResult.once('end', () => {
      this.sse.send(folderName, `scannedBoxes${this.user.id}`);

      if (this.isLastFolderToFetch(folderName)) {
        this.connection.end();
      } else {
        // go to the next folder
        this.fetchFolder(
          this.folders[this.folders.indexOf(folderName) + 1]
        ).next();
      }
    });
  }

  isLastFolderToFetch(folderName) {
    return this.folders.indexOf(folderName) + 1 === this.folders.length;
  }

  /**
   * Publishes an email message to Redis.
   * @param {string} seqNumber  - The sequence number of the email message.
   * @param {object} header  - The header of the email message.
   * @param {string} body - The body of the email message.
   * @param {string} folderName - The name of the folder that the message is in.
   * @param {boolean} isLast - Indicates whether this was the last message to fetch.
   * @returns {Promise<void>}
   */
  async publishMessageToChannel(seqNumber, header, body, folderName, isLast) {
    const message = JSON.stringify({
      seqNumber,
      body,
      header,
      userId: this.user.id,
      userEmail: this.user.email,
      folderName,
      isLast
    });

    await redisClientForPubSubMode.publish(REDIS_MESSAGES_CHANNEL, message);
  }

  /**
   * Checks whether we should send fetching progress based on the sequence number of the fetched email message.
   * @param {number} seqNumber - Sequence number of the fetched email message.
   * @returns {boolean}
   */
  shouldSendFetchingProgress(seqNumber) {
    return this.sends.includes(seqNumber);
  }

  /**
   * Checks whether we should populate the refined_persons table based on the current fetched email.
   * @param {number} seqNumber - Sequence number of the fetched email message.
   * @returns {boolean}
   */
  shouldPopulateRefinedPersons(seqNumber) {
    return this.emailsProgressIndexes.includes(seqNumber);
  }

  /**
   * Sends the current fetching progress through SSE.
   * @returns {void}
   */
  sendFetchingProgress() {
    logger.debug('Sending SSE progress', {
      user: this.user.userIdentifierHash,
      messagesFetched: this.fetchedMessagesCount
    });
    this.sse.send(this.fetchedMessagesCount, `ScannedEmails${this.user.id}`);
  }

  /**
   * Populates the refined_persons table with initial data.
   * @returns {Promise<void>}
   */
  async sendMinedData() {
    // call supabase function to refine data

    try {
      logger.debug('Calling function populate_refined', {
        user: this.user.userIdentifierHash
      });
      await db.callRpcFunction(this.user.id, 'populate_refined');
    } catch (error) {
      logger.error('Error from callRpcFunction(): ', error);
    }
  }
}

module.exports = EmailAccountMiner;
