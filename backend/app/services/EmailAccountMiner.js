const imapTreeHelpers = require('../utils/imapTreeHelpers');
const hashHelpers = require('../utils/hashHelpers');
const inputHelpers = require('../utils/inputHelpers');
const Imap = require('imap');
const logger = require('../utils/logger')(module);

const redisClientForPubSubMode =
  require('../../redis').redisClientForPubSubMode();

const { supabaseHandlers } = require('./supabase/index');
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
  constructor(
    connection,
    user,
    sse,
    fields,
    folders,
    eventEmitter,
    evenMessageWorker,
    oddMessageWorker
  ) {
    this.connection = connection;
    this.user = user;
    this.sse = sse;
    this.fields = fields;
    this.folders = folders;
    this.eventEmitter = eventEmitter;
    this.mailHash = hashHelpers.hashEmail(user.email);
    this.messageWorkerOddSeqNumber = oddMessageWorker;
    this.messageWorkerEvenSeqNumber = evenMessageWorker;
  }

  /**
   * getTree connects to the IMAP server, gets the tree of folders, adds the total number of emails per
   * folder, and then adds the total number of emails per parent folder
   * @returns a promise that resolves to an array of two elements. The first element is the tree object,
   * the second element is an error object.
   */
  getTree() {
    return new Promise((resolve) => {
      let result = [];
      this.connection.connecte().then((connection) => {
        this.connection = connection;
        this.connection.once('ready', () => {
          logger.info('Started mining folders tree for user.', {
            emailHash: this.mailHash
          });
          this.connection.getBoxes('', async (err, boxes) => {
            if (err) {
              logger.error('Failed mining folders tree for user', {
                error: err,
                emailHash: this.mailHash
              });
              result = [this.tree, err];
              resolve(result);
            }
            // extract only folder name
            const treeObjectWithChildrens =
                imapTreeHelpers.createTreeFromImap(boxes),
              // add a path for each folder
              treeWithPaths = imapTreeHelpers.addPathPerFolder(
                treeObjectWithChildrens,
                treeObjectWithChildrens
              );
            // extract the total for each folder

            await this.getTreeWithTotalPerFolder(treeWithPaths);
            // sum childrens total for folder that has childrens
            this.tree = imapTreeHelpers.addChildrenTotalForParentFiles(
              treeWithPaths,
              this.user.email
            );
          });
        });
        this.connection.once('close', () => {
          logger.info('Finished mining folders tree for user.', {
            emailHash: this.mailHash
          });
          result = [this.tree, null];
          resolve(result);
        });
        this.connection.once('error', (error) => {
          logger.error('Failed mining folders tree for user', {
            error,
            emailHash: this.mailHash
          });
          result = [this.tree, error];
          resolve(result);
        });
      });
    });
  }

  /**
   * getTreeWithTotalPerFolder takes an imapTree, and for each folder in the tree, it opens the folder, and if it exists, it
   * adds the total number of messages
   * @param {object} imapTree - The tree of folders that you want to get the total number of messages for.
   * @returns {Promise<object>} A promise that resolves to the imapTree with the total number of messages per folder.
   */
  getTreeWithTotalPerFolder(imapTree) {
    const self = this;
    return new Promise((resolve) => {
      imapTree.forEach((folder) => {
        function openBoxThenGetTotal() {
          self.connection.openBox(folder.path, true, (err, box) => {
            if (box) {
              folder.total = box.messages.total;
            } else {
              folder.total = 0;
            }
            if (folder === imapTree[imapTree.length - 1]) {
              self.connection.end();
              resolve();
            }
          });
        }
        // the folder has childrens
        if (Object.prototype.hasOwnProperty.call(folder, 'children')) {
          openBoxThenGetTotal();
          // recal on the children
          this.getTreeWithTotalPerFolder(folder.children);
        } else {
          // has no childrens
          openBoxThenGetTotal();
        }
      });
    });
  }
  /**
   * getTreeByFolder connects to the IMAP server, opens the folder, and returns the folder's tree
   * @param {string} folderName - the name of the folder you want to get the tree from.
   */
  getTreeByFolder(folderName) {
    logger.debug(`fetching tree per folder for user : ${this.mailHash}`);

    let tree = {};
    const folderPath = imapTreeHelpers.getFolderPathFromTreeObject(
      tree,
      folderName
    );
    this.connection.initConnection();
    this.connection.connect();
    this.connection.once('ready', () => {
      this.connection.openBox(folderPath, true, (err, box) => {
        tree = box;
        this.connection.end();
      });
    });
    this.connection.once('close', () => {
      logger.debug(`End fetching tree per folder for user : ${this.mailHash}`);

      return tree;
    });
  }

  /**
   * mine connects to the IMAP server, and then calls the mineFolder() function on the first folder in the
   * folders array
   */
  async mine() {
    // init the connection using the user info (name, host, port, password, token...)
    this.connection.initConnection();
    this.connection = await this.connection.connecte();
    this.connection.once('ready', () => {
      logger.info('Started mining email messages for user.', {
        emailHash: this.mailHash
      });
      this.messageWorkerOddSeqNumber.postMessage(this.user.id);
      this.messageWorkerEvenSeqNumber.postMessage(this.user.id);
      setTimeout(() => {
        this.mineFolder(this.folders[0]).next();
      }, 1500);
    });
    // cancelation using req.close event from user(frontend button)
    this.eventEmitter.on('endByUser', () => {
      this.connection.destroy();
      logger.info('Connection to IMAP server destroyed by user.', {
        emailHash: this.mailHash
      });
      // this.eventEmitter.emit("end", true);
    });

    this.connection.on('error', (err) => {
      logger.error('Error with IMAP connection.', { error: err });
    });
    this.connection.once('close', () => {
      logger.info('Finished collecting emails for user.', {
        emailHash: this.mailHash
      });
      // sse here to send data based on end event
      this.sse.send(true, 'data');
      this.sse.send(true, `dns${this.user.id}`);
      logger.debug('SSE data and dns events sent!');
      this.eventEmitter.emit('end', true);
      logger.debug('End connection using end event');
    });
  }
  /**
   * mineFolder is a generator function it opens a folder, and when it's done, it mines the messages in that folder
   * and loops through all selected folders
   * @param folder - The folder you want to mine.
   */
  *mineFolder(folder) {
    logger.debug('Started mining email messages from folder.', {
      emailHash: this.mailHash,
      folder
    });

    // we use generator to stope function execution then we recall it with new params using next()
    yield this.connection.openBox(folder, true, (err, openedFolder) => {
      if (openedFolder) {
        logger.debug(
          `Opening mail box folder: ${openedFolder.name} for User: ${this.mailHash}`
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
      logger.debug(
        `Mining folder size: ${folder.messages.total} for User: ${this.mailHash}`
      );
      // used in sending progress
      this.sends = inputHelpers.EqualPartsForSocket(
        folder.messages.total,
        'position'
      );
      this.emailsProgressIndexes = inputHelpers.EqualPartsForSocket(
        folder.messages.total,
        'data'
      );
      // fetching method
      this.ImapFetch(folder, folderName);
      // fetch function : pass fileds to fetch
    } else if (this.folders.indexOf(folderName) + 1 === this.folders.length) {
      logger.debug(`Done for User: ${this.mailHash}`);
      this.connection.end();
      this.connection.destroy();
    } else {
      // if this folder is just a label then pass to the next folder
      logger.debug(
        `Going to next folder, this one is undefined or a label in folders array for User: ${this.mailHash}`
      );
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
    let self = this;
    const fetchResult = this.connection.seq.fetch('1:*', {
      bodies: self.fields,
      struct: true
    });

    logger.debug(
      `Fetch method using bodies ${self.fields} for User: ${this.mailHash}`
    );
    // message event
    fetchResult.on('message', (msg, seqNumber) => {
      let Header = '',
        body = '';

      msg.on('body', (stream, streamInfo) => {
        // parse the chunks of the message

        stream.on('data', (chunk) => {
          if (streamInfo.which.includes('HEADER')) {
            Header += chunk;
          } else {
            body += chunk;
          }
        });
      });
      msg.once('end', () => {
        // if end then push to queue
        const header = Header,
          Body = body;

        self.publishMessageToChannel(seqNumber, header, Body, folderName);
        Header = '';
        body = '';
      });
    });
    // end event
    fetchResult.once('end', () => {
      logger.debug('Finished mining email messages from folder.', {
        emailHash: this.mailHash,
        folder: folder.name
      });
      this.sse.send(folderName, `scannedBoxes${this.user.id}`);
      if (self.folders.indexOf(folder.name) + 1 === self.folders.length) {
        // we are at the end of the folder array==>> end imap connection
        logger.debug(
          `We are done...Ending connection for User: ${this.mailHash}`
        );
        this.connection.end();
        self = null;
      } else {
        // go to the next folder
        logger.debug(
          `Going to next folder in folders array for User: ${this.mailHash}`
        );
        self
          .mineFolder(self.folders[self.folders.indexOf(folder.name) + 1])
          .next();
        self = null;
      }
    });
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
    if (this.sends.includes(seqNumber)) {
      console.log('*************');
      this.sendMiningProgress(seqNumber, folderName);
    }
    if (this.emailsProgressIndexes.includes(seqNumber)) {
      this.sendMinedData(seqNumber, folderName);
    }
    const Header = Imap.parseHeader(header.toString('utf8'));
    // TODO : check message if it's already mined
    // const message_id = Header['message-id'] ? Header['message-id'][0] : '';
    // redisClientForNormalMode
    //   .sismember('messages', message_id)
    //   .then((alreadyMined) => {
    //     if (!alreadyMined) {
    //publish the message to the odd channel
    if (seqNumber % 2 !== 0) {
      redisClientForPubSubMode.publish(
        `odd-messages-channel-${this.user.id}`,
        JSON.stringify({
          seqNumber,
          body,
          header: JSON.stringify(Header),
          user: this.user,
          folderName
        })
      );
    } else {
      redisClientForPubSubMode.publish(
        `even-messages-channel-${this.user.id}`,
        JSON.stringify({
          seqNumber,
          body,
          header: JSON.stringify(Header),
          user: this.user,
          folderName
        })
      );
    }
    //   }
    // });
  }

  /**
   * sendMiningProgress sends the progress of the mining process to the user's browser
   * @param seqNumber - The current sequence number of the email being scanned
   * @param folderName - The name of the folder being scanned
   */
  sendMiningProgress(seqNumber, folderName) {
    // as it's a periodic function, we can watch memory usage here
    // we can also force garbage_collector if we have many objects are created
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`Used Memory ${used} mb`);
    if (Math.round(used * 100) / 100 > 170) {
      logger.debug(`Used Memory ${used} is high...forcing garbage collector`);
      global.gc();
    }
    // define the progress
    let progress = seqNumber;

    if (this.sends[this.sends.indexOf(seqNumber) - 1]) {
      progress = seqNumber - this.sends[this.sends.indexOf(seqNumber) - 1];
    }
    logger.debug(
      `Progress for user ${this.mailHash} is ${seqNumber} at folder ${folderName}`
    );
    this.sse.send(
      {
        scanned: progress
      },
      `ScannedEmails${this.user.id}`
    );
  }

  /**
   * sendMinedData fires up refining worker when it's called
   * @param seqNumber - The sequence number of the mined data.
   * @param folderName - The name of the folder that contains the mined data.
   */
  sendMinedData(seqNumber, folderName) {
    logger.debug(
      `Sending minedData at ${seqNumber} and folder: ${folderName}...`
    );

    // call supabase function to refine data
    supabaseHandlers
      .invokeRpc('refined_persons', {
        userid: this.user.id
      })
      .then((res) => {
        if (res.error) {
          logger.error(res.error);
        }
      });
  }
}

module.exports = EmailAccountMiner;
