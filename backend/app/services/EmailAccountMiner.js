const imapTreeHelpers = require('../utils/helpers/imapTreeHelpers');
const hashHelpers = require('../utils/helpers/hashHelpers');
const inputHelpers = require('../utils/helpers/inputHelpers');
const Imap = require('imap');
const logger = require('../utils/logger')(module);
const { redis } = require('../utils/redis');
const redisClientForPubSubMode = redis.getPubSubClient();

const { db } = require('../db');
const { imapFetchBody } = require('../config/server.config');
const { REDIS_MESSAGES_CHANNEL } = require('../utils/constants');

class EmailAccountMiner {
  // public field
  tree = [];
  currentTotal = 0;
  sends = [];
  emailsProgressIndexes = [];

  /**
   * This function is a constructor for the class `EmailAccountMiner`
   * @param {object} connection - The connection to the imapserver.
   * @param {object} user - The user object that is currently associated with the connection.
   * @param {object} sse - The SSE object that will be used to send the data to the client.
   * @param {array} fields - An array of fields to be used in the fetch.
   * @param {array} folders - An array of folder paths to fetch from.
   */
  constructor(connection, user, sse, fields, folders, eventEmitter) {
    this.connection = connection;
    this.user = user;
    this.sse = sse;
    this.fields = fields;
    this.folders = folders;
    this.eventEmitter = eventEmitter;
    this.mailHash = hashHelpers.hashEmail(user.email);
    this.lastFolder = false;
    this.lastMessage = false;
    this.fetchedMessagesCount = 0;
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
      performance.mark('fetchBoxes-start')
      let result = [];
      this.connection.connect().then((connection) => {
        this.connection = connection;
        this.connection.once('ready', () => {
          logger.info('Started mining folders tree for user.', {
            emailHash: this.mailHash
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
            emailHash: this.mailHash, duration: performance.measure('fetchBoxes-start').duration
          });
          result = [this.tree, null];
          resolve(result);
        });

        this.connection.once('error', (error) => {
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
    const self = this;

    const promises = folders.map((folder) => {
      return new Promise((resolve, reject) => {
        self.connection.openBox(folder.path, true, (err, box) => {
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
   * mine connects to the IMAP server, and then calls the mineFolder() function on the first folder in the
   * folders array
   */
  async mine() {
    // init the connection using the user info (name, host, port, password, token...)
    this.connection.initConnection();
    this.connection = await this.connection.connect();
    this.connection.once('ready', () => {
      performance.mark('fetching-start')
      logger.info('Started mining email messages for user.', {
        emailHash: this.mailHash
      });
      this.mineFolder(this.folders[0]).next();
    });
    // cancelation using req.close event from user(frontend button)
    this.eventEmitter.on('endByUser', () => {
      this.connection.end();
      logger.info('Connection to IMAP server destroyed by user.', {
        emailHash: this.mailHash,
      });
    });

    this.connection.on('error', (err) => {
      logger.error('Error with IMAP connection.', { error: err });
      this.eventEmitter.emit('error');
    });
    this.connection.once('close', () => {
      logger.info('Finished collecting emails for user.', {
        emailHash: this.mailHash, duration: performance.measure('fetching-start').duration
      });

      // sse here to send data based on end event
      this.sse.send(true, 'data');
      this.sse.send(true, `dns${this.user.id}`);
      this.eventEmitter.emit('end', true);
    });
  }
  /**
   * mineFolder is a generator function it opens a folder, and when it's done, it mines the messages in that folder
   * and loops through all selected folders
   * @param folder - The folder you want to mine.
   */
  *mineFolder(folder) {
    // we use generator to stope function execution then we recall it with new params using next()
    yield this.connection.openBox(folder, true, (err, openedFolder) => {
      if (this.isLastFolderToFetch(folder)) {
        this.lastFolder = true;
      }
      if (err) {
        logger.error(
          `Error occurred when opening folder for User: ${this.mailHash}`
        );
      }
      this.mineMessages(openedFolder, folder);
    });
  }

  /**
   * mineMessages takes a folder name as an argument,and calls the fetching method.
   * @param {object} folder - The folder to mine.
   * @param {string} folderName - The name of the current folder.
   */
  mineMessages(folder, folderName) {
    if (folder) {
      this.currentTotal = folder.messages.total;
      this.sends = inputHelpers.EqualPartsForSocket(
        folder.messages.total,
        'position'
      );
      this.emailsProgressIndexes = inputHelpers.EqualPartsForSocket(
        folder.messages.total,
        'data'
      );
      this.ImapFetch(folder, folderName);
    } else if (this.folders.indexOf(folderName) + 1 === this.folders.length) {
      this.connection.end();
    } else {
      // if this folder is just a label then pass to the next folder
      this.mineFolder(
        this.folders[this.folders.indexOf(folderName) + 1]
      ).next();
    }
  }

  /**
   * ImapFetch fetches all the messages in a folder and pushes them to a queue
   * @param {object} folder - the folder object
   * @param {string} folderName - The name of the folder we are mining
   */
  ImapFetch(folder, folderName) {
    const self = this;

    const bodies = ['HEADER'];
    if (imapFetchBody) {
      bodies.push('TEXT');
    }

    const fetchResult = this.connection.seq.fetch('1:*', {
      bodies
    });

    fetchResult.on('message', (msg, seqNumber) => {
      logger.debug('Message #%d', seqNumber);
      this.lastMessage = seqNumber === folder.messages.total;

      const prefix = `(#${seqNumber}) `;

      msg.on('body', (stream, streamInfo) => {
        let header = '';
        let body = '';

        stream.on('data', (chunk) => {
          if (streamInfo.which.includes('HEADER')) {
            header += chunk;
          } else {
            body += chunk;
          }
        });

        stream.once('end', () => {
          const parsedHeader = Imap.parseHeader(header.toString('utf8'));
          const parsedBody = body.toString('utf8');

          this.fetchedMessagesCount++;
          self.publishMessageToChannel(
            seqNumber,
            parsedHeader,
            parsedBody,
            folderName
          );
        });
      });

      msg.once('end', () => {
        logger.debug(`${prefix}Finished`);
      });
    });

    fetchResult.on('error', (err) => {
      logger.error(`Fetch error: ${err}`);
    });

    fetchResult.once('end', () => {
      this.sse.send(folderName, `scannedBoxes${this.user.id}`);

      if (this.isLastFolderToFetch(folderName)) {
        // we are at the end of the folder array==>> end imap connection
        this.connection.end();
      } else {
        // go to the next folder
        self
          .mineFolder(self.folders[self.folders.indexOf(folder.name) + 1])
          .next();
      }
    });
  }

  isLastFolderToFetch(folderName) {
    return this.folders.indexOf(folderName) + 1 === this.folders.length;
  }

  /**
   * publishMessageToChannel pushes the message to the queue and then calls the getMessageFromQueue function to get the
   * message from the queue asynchronously
   * @param seqNumber - The sequence number of the message
   * @param Header - The header of the email
   * @param Body - The body of the email
   * @param folderName - The name of the folder that the message is in.
   */
  publishMessageToChannel(seqNumber, header, body, folderName) {
    this.sendMiningProgress(seqNumber);

    if (this.emailsProgressIndexes.includes(seqNumber)) {
      this.sendMinedData();
    }

    const message = JSON.stringify({
      seqNumber,
      body,
      header,
      user: this.user,
      folderName,
      isLast: this.lastFolder && this.lastMessage
    });

    redisClientForPubSubMode.publish(REDIS_MESSAGES_CHANNEL, message);
  }

  /**
   * sendMiningProgress sends the progress of the mining process to the user's browser
   * @param seqNumber - The current sequence number of the email being scanned
   */
  sendMiningProgress(seqNumber) {
    // define the progress
    if (this.sends.includes(seqNumber)) {
      this.sse.send(this.fetchedMessagesCount, `ScannedEmails${this.user.id}`);
    }
  }

  /**
   * sendMinedData fires up refining worker when it's called
   */
  sendMinedData() {
    // call supabase function to refine data
    db.refinePersons(this.user.id).then((res) => {
      if (res.error) {
        logger.error(res.error);
      }
    });
  }
}

module.exports = EmailAccountMiner;
