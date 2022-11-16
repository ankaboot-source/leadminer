const imapTreeHelpers = require('../utils/helpers/imapTreeHelpers');
const hashHelpers = require('../utils/helpers/hashHelpers');
const inputHelpers = require('../utils/helpers/inputHelpers');
const Imap = require('imap');
const logger = require('../utils/logger')(module);
const { redis } = require('../utils/redis');
const { Worker } = require('worker_threads');
const redisClientForPubSubMode = redis.getPubSubClient();
const data = 'messageWorker initiated',
  evenMessageWorker = new Worker('./app/workers/evenMessageWorker.js', {
    data
  }),
  oddMessageWorker = new Worker('./app/workers/oddMessageWorker.js', {
    data
  });
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
  constructor(connection, user, sse, fields, folders, eventEmitter) {
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
            await this.AddTotalPerFolder(treeWithPaths).then(() => {
              this.tree = imapTreeHelpers.BuildFinaltTree(treeWithPaths, this.user.email);
              this.connection.end();
            });
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
          result = [this.tree, error];
          resolve(result);
        });
      });
    });
  }

  /**
   * AddTotalPerFolder Gets the total number of messages per folder
   * @param {array} folders - flat array of objects.
   * @returns {Promise<object>} A promise that resolves to the folders with the total number of messages.
   */
  AddTotalPerFolder(folders) {
    const self = this;

    const promises = folders.map((folder, index) => {
      return new Promise((resolve) => {
        self.connection.openBox(folder.path, true, (err, box) => {

          if (box) {
            folders[index].total = box.messages.total; 
          } else {
            folders[index].total = 0; 
          }
          resolve();
        });
      });
    });
    return Promise.all(promises);
  }

  /**
   * getTreeByFolder connects to the IMAP server, opens the folder, and returns the folder's tree
   * @param {string} folderName - the name of the folder you want to get the tree from.
   */
  getTreeByFolder(folderName) {
    let tree = {};
    const folderPath = imapTreeHelpers.getFolderPathFromTreeObject(
      tree,
      folderName
    );
    this.connection.initConnection();
    this.connection.connect();
    this.connection.once('ready', () => {
      this.connection.openBox(folderPath, true, (err, box) => {
        if (err) {
          return tree;
        }
        tree = box;
        this.connection.end();
      });
    });
    this.connection.once('close', () => {
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
    this.connection = await this.connection.connect();
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
      if (err) {
        logger.error(
          `Error occured when opening folder for User: ${this.mailHash}`
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
      this.connection.end();
      this.connection.destroy();
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
    let self = this;
    const fetchResult = this.connection.seq.fetch('1:*', {
      bodies: self.fields,
      struct: true
    });

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
      this.sse.send(folderName, `scannedBoxes${this.user.id}`);
      if (self.folders.indexOf(folder.name) + 1 === self.folders.length) {
        // we are at the end of the folder array==>> end imap connection
        setTimeout(() => {
          this.messageWorkerEvenSeqNumber.terminate();
          this.messageWorkerOddSeqNumber.terminate();
        }, 5000);
        this.connection.end();
        self = null;
      } else {
        // go to the next folder
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
    this.sendMiningProgress(seqNumber);

    if (this.emailsProgressIndexes.includes(seqNumber)) {
      this.sendMinedData();
    }
    const Header = Imap.parseHeader(header.toString('utf8'));
    //publish the message to the odd channel
    const message = JSON.stringify({
      seqNumber,
      body,
      header: Header,
      user: this.user,
      folderName
    });
    if (seqNumber % 2 !== 0) {
      redisClientForPubSubMode.publish(
        `odd-messages-channel-${this.user.id}`,
        message
      );
    } else {
      redisClientForPubSubMode.publish(
        `even-messages-channel-${this.user.id}`,
        message
      );
    }

    //   }
    // });
  }

  /**
   * sendMiningProgress sends the progress of the mining process to the user's browser
   * @param seqNumber - The current sequence number of the email being scanned
   */
  sendMiningProgress(seqNumber) {
    // as it's a periodic function, we can watch memory usage here
    // we can also force garbage_collector if we have many objects are created

    // define the progress
    if (this.sends.includes(seqNumber)) {
      const progress =
        seqNumber - (this.sends[this.sends.indexOf(seqNumber) - 1] ?? 0);

      this.sse.send(
        {
          scanned: progress
        },
        `ScannedEmails${this.user.id}`
      );
    }
  }

  /**
   * sendMinedData fires up refining worker when it's called
   */
  sendMinedData() {
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
