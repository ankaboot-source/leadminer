const imapTreeHelpers = require("../utils/imapTreeHelpers");
const hashHelpers = require("../utils/hashHelpers");
const minedDataHelpers = require("../utils/minedDataHelpers");
const inputHelpers = require("../utils/inputHelpers");
const Imap = require("imap"),
  logger = require("../utils/logger")(module);
const redisClient = require("../../redis");

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
    messageWorker
  ) {
    this.connection = connection;
    this.user = user;
    this.sse = sse;
    this.fields = fields;
    this.folders = folders;
    this.eventEmitter = eventEmitter;
    this.mailHash = hashHelpers.hashEmail(user.email);
    this.messageWorkerForBody = messageWorker;
    this.messageWorkerForHeader = messageWorker;
  }

  /**
   * getTree connects to the IMAP server, gets the tree of folders, adds the total number of emails per
   * folder, and then adds the total number of emails per parent folder
   * @async
   * @returns a promise that resolves to an array of two elements. The first element is the tree object,
   * the second element is an error object.
   */
  async getTree() {
    return new Promise(async (resolve, reject) => {
      let result = [];
      this.connection = await this.connection.connecte();
      this.connection.once("ready", () => {
        logger.info(`Begin mining folders tree for user : ${this.mailHash}`);
        this.connection.getBoxes("", async (err, boxes) => {
          // extract only folder name
          const treeObjectWithChildrens =
              imapTreeHelpers.createReadableTreeObjectFromImapTree(boxes),
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
      this.connection.once("end", () => {
        logger.info(`End mining folders tree for user : ${this.mailHash}`);
        result = [this.tree, null];
        resolve(result);
      });
      this.connection.once("error", (error) => {
        logger.error(
          `Failed mining folders tree for user: ${this.mailHash}  raison: ${error}`
        );
        result = [this.tree, error];
        resolve(result);
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
    return new Promise((resolve, reject) => {
      imapTree.map((folder) => {
        // the folder has childrens
        if (folder.hasOwnProperty("children")) {
          this.connection.openBox(folder.path, true, (err, box) => {
            if (box) {
              folder.total = box.messages.total;
            } else {
              folder.total = 0;
            }

            if (folder == imapTree[imapTree.length - 1]) {
              resolve();
              this.connection.end();
            }
          });
          // recal on the children
          this.getTreeWithTotalPerFolder(folder.children);
        } else {
          // has no childrens
          this.connection.openBox(folder.path, true, (err, box) => {
            if (box) {
              folder.total = box.messages.total;
            } else {
              folder.total = 0;
            }
            if (folder == imapTree[imapTree.length - 1]) {
              resolve();
              this.connection.end();
            }
          });
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
    this.connection.once("ready", () => {
      this.connection.openBox(folderPath, true, (err, box) => {
        tree = box;
        this.connection.end();
      });
    });
    this.connection.once("end", () => {
      logger.debug(`end fetching tree per folder for user : ${this.mailHash}`);

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
    this.connection.once("ready", async () => {
      logger.info(`Begin mining emails messages for user: ${this.mailHash}`);
      this.mineFolder(this.folders[0]).next();
    });
    // cancelation using req.close event from user(frontend button)
    this.eventEmitter.on("endByUser", () => {
      this.connection.destroy();
      logger.info(
        `Connection to imap server destroyed by user: ${this.mailHash}`
      );
      // this.eventEmitter.emit("end", true);
    });

    this.connection.on("error", (err) => {
      logger.error(`Error with imap connection${err}`);
    });
    this.connection.once("end", () => {
      logger.info(`End collecting emails for user: ${this.mailHash}`);
      // sse here to send data based on end event
      this.sse.send(true, "data");
      this.sse.send(true, "dns");
      logger.debug("sse data and dns events sent!");
      this.eventEmitter.emit("end", true);
      logger.debug("End connection using end event");
    });
  }
  /**
   * mineFolder is a generator function it opens a folder, and when it's done, it mines the messages in that folder
   * and loops through all selected folders
   * @param folder - The folder you want to mine.
   */
  *mineFolder(folder) {
    logger.info(
      `Begin mining email messages from folder:${folder} for user: ${this.mailHash}`
    );

    // we use generator to stope function execution then we recall it with new params using next()
    yield this.connection.openBox(folder, true, async (err, openedFolder) => {
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
        "position"
      );
      this.emailsProgressIndexes = inputHelpers.EqualPartsForSocket(
        folder.messages.total,
        "data"
      );
      // fetching method
      this.ImapFetch(folder, folderName);
      // fetch function : pass fileds to fetch
    } else if (this.folders.indexOf(folderName) + 1 == this.folders.length) {
      logger.debug(`Done for User: ${this.mailHash}`);
      this.connection.end();
      this.connection.destroy();
    } else {
      // if this folder is juste a label then pass to the next folder
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
    const f = this.connection.seq.fetch("1:*", {
      bodies: self.fields,
      struct: true,
    });

    logger.debug(
      `Fetch method using bodies ${self.fields} for User: ${this.mailHash}`
    );
    // message event
    f.on("message", (msg, seqNumber) => {
      let Header = "",
        body = "";

      msg.on("body", (stream, streamInfo) => {
        // parse the chunks of the message

        stream.on("data", async (chunk) => {
          if (streamInfo.which.includes("HEADER")) {
            Header += chunk;
          } else {
            body += chunk;
          }
        });
      });
      msg.once("end", () => {
        // if end then push to queue
        const header = Header,
          Body = body;

        self.pushMessageToQueue(seqNumber, header, Body, folderName);
        Header = "";
        body = "";
      });
    });
    // end event
    f.once("end", () => {
      logger.info(
        `End mining email messages from folder:${folder.name} for user: ${this.mailHash}`
      );
      this.sse.send(folderName, `scannedBoxes${this.user.id}`);
      if (self.folders.indexOf(folder.name) + 1 == self.folders.length) {
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
   * Takes the sequence message number, the part it's being mined and the date in case of a body
   * then it will retrieve from redis queue a message and parses it
   * @param seqNumber - The sequence number of the block that is being mined.
   * @param type - "body" or "header"
   * @param dateInCaseOfBody - This is the date of the body that is being mined.
   */
  async getMessageFromQueue(seqNumber, type, dateInCaseOfBody) {
    if (type == "body") {
      redisClient.rpop("bodies").then((data) => {
        this.mineMessage(seqNumber, undefined, data, dateInCaseOfBody);
      });
    } else {
      redisClient.rpop("headers").then((data) => {
        if (data) {
          this.mineMessage(seqNumber, JSON.parse(data), undefined, "");
        }
      });
    }
  }
  /**
   * pushMessageToQueue pushes the message to the queue and then calls the getMessageFromQueue function to get the
   * message from the queue asynchronously
   * @param seqNumber - The sequence number of the message
   * @param Header - The header of the email
   * @param Body - The body of the email
   * @param folderName - The name of the folder that the message is in.
   */
  async pushMessageToQueue(seqNumber, header, Body, folderName) {
    const Header = Imap.parseHeader(header.toString("utf8"));

    if (this.sends.includes(seqNumber)) {
      this.sendMiningProgress(seqNumber, folderName);
    }
    if (this.emailsProgressIndexes.includes(seqNumber)) {
      this.sendMinedData(seqNumber, folderName);
    }
    const message_id = Header["message-id"] ? Header["message-id"][0] : "";
    redisClient.sismember("messages", message_id).then((alreadyMined) => {
      if (!alreadyMined) {
        if (Body && Body != "") {
          redisClient.lpush("bodies", Body).then(() => {
            this.getMessageFromQueue(
              seqNumber,
              "body",
              Header.date ? Header.date[0] : ""
            );
          });
        }
        if (Header && Header != "") {
          redisClient.lpush("headers", JSON.stringify(Header)).then(() => {
            this.getMessageFromQueue(seqNumber, "header", "");
          });
        }
      }
    });
  }

  /**
   * This function takes in a sequence number, header, and body of an email message, creates an
   * EmailMessage object, extracts email objects from the header and body
   * @param seqNumber - The sequence number of the email message.
   * @param header - The header of the email message
   * @param body - The body of the email message
   * @param dataInCaseOfBody - The date of a message
   */
  async mineMessage(seqNumber, header, body, dateInCaseOfBody) {
    // create EmailMessage object
    const message = {
      seq: seqNumber,
      header: header,
      body: body,
      user: this.user,
      date: dateInCaseOfBody,
    };

    if (body) {
      this.messageWorkerForBody.postMessage(message);
    } else {
      this.messageWorkerForHeader.postMessage(message);
    }
  }

  /**
   * sendMiningProgress sends the progress of the mining process to the user's browser
   * @param seqNumber - The current sequence number of the email being scanned
   * @param folderName - The name of the folder being scanned
   */
  async sendMiningProgress(seqNumber, folderName) {
    // as it's a periodic function, we can watch memory usage here
    // we can also force garbage_collector if we have many objects are created
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    logger.debug(`Used Memory ${used} mb`);
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
        scanned: progress,
      },
      `ScannedEmails${this.user.id}`
    );
  }

  async sendMinedData(seqNumber, folderName) {
    logger.debug(
      `Sending minedData at ${seqNumber} and folder: ${folderName}...`
    );
    minedDataHelpers.getEmails(this.user.id).then((data) => {
      minedDataHelpers.getCountDB(this.user.id).then(async (totalScanned) => {
        const sortedData = minedDataHelpers.sortDatabase(data);
        const minedEmails = sortedData[0];
        const transactional = sortedData[1];
        const noReply = await redisClient.get("noReply");
        const invalidDomain = await redisClient.get("invalid");
        this.sse.send(
          {
            data: minedEmails,
            totalScanned: totalScanned,
            statistics: {
              noReply: noReply,
              invalidDomain: invalidDomain,
              transactional: transactional,
            },
          },
          `minedEmails${this.user.id}`
        );
      });
    });
  }
}

module.exports = EmailAccountMiner;
