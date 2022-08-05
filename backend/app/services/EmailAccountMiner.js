const dataStructureHelpers = require("../utils/dataStructureHelpers");
const hashHelpers = require("../utils/hashHelpers");
const databaseHelpers = require("../utils/databaseHelpers");
const inputHelpers = require("../utils/inputHelpers");
const MAX_BATCH_SIZE = process.env.MAX_BATCH_SIZE;
const EmailMessage = require("./EmailMessage");
const Imap = require("imap");
const logger = require("../utils/logger")(module);
const redisClient = require("../../redis");
const inspect = require("util").inspect;

class EmailAccountMiner {
  //public field
  tree = [];
  currentTotal = 0;
  sends = [];

  /**
   * This function is a constructor for the class `EmailAccountMiner`
   * @param {object} connection - The connection to the imapserver.
   * @param {object} user - The user object that is currently associated with the connection.
   * @param {object} sse - The SSE object that will be used to send the data to the client.
   * @param {array} fields - An array of fields to be used in the fetch.
   * @param {array} folders - An array of folder paths to fetch from.
   * @param {object} cursor - The cursor is the current fetch position.
   * @param {number} batch_size - The number of records to dtore in each batch.
   */
  constructor(
    connection,
    user,
    sse,
    fields,
    folders,
    cursor,
    batch_size,
    eventEmitter
  ) {
    this.connection = connection;
    this.user = user;
    this.sse = sse;
    this.fields = fields;
    this.folders = folders;
    this.cursor = cursor;
    this.batch_size = batch_size || MAX_BATCH_SIZE;
    this.eventEmitter = eventEmitter;
    this.mailHash = hashHelpers.hashEmail(user.email);
  }

  /**
   * It connects to the IMAP server, gets the tree of folders, adds the total number of emails per
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
            dataStructureHelpers.createReadableTreeObjectFromImapTree(boxes);
          // add a path for each folder
          const treeWithPaths = dataStructureHelpers.addPathPerFolder(
            treeObjectWithChildrens,
            treeObjectWithChildrens
          );
          // extract the total for each folder
          await this.getTreeWithTotalPerFolder(treeWithPaths);
          // sum childrens total for folder that has childrens
          this.tree = dataStructureHelpers.addChildrenTotalForParentFiles(
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
   * It takes an imapTree, and for each folder in the tree, it opens the folder, and if it exists, it
   * adds the total number of messages in the folder to the folder object
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
              folder["total"] = box.messages.total;
            } else {
              folder["total"] = 0;
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
              folder["total"] = box.messages.total;
            } else {
              folder["total"] = 0;
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
   * It connects to the IMAP server, opens the folder, and returns the folder's tree
   * @param {string} folderName - the name of the folder you want to get the tree from.
   */
  getTreeByFolder(folderName) {
    logger.debug(`fetching tree per folder for user : ${this.mailHash}`);

    let tree = {};
    const folderPath = dataStructureHelpers.getFolderPathFromTreeObject(
      tree,
      folderName
    );
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
   * It connects to the IMAP server, and then calls the mineFolder() function on the first folder in the
   * folders array
   */
  async mine() {
    //this.mineFolder(this.fields, this.folders);
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
      //this.eventEmitter.emit("end", true);
    });

    this.connection.on("error", (err) => {
      logger.error(`Error with imap connection${err}`);
    });
    this.connection.once("end", () => {
      logger.info(`End collecting emails for user: ${this.mailHash}`);
      // sse here to send data based on end event
      this.sse.send(true, "data");
      this.sse.send(true, "dns");
      logger.debug(`sse data and dns events sent!`);
      this.eventEmitter.emit("end", true);
      logger.debug(`End connection using end event`);
    });
  }
  /**
   * It opens a folder, and when it's done, it mines the messages in that folder
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
   * It takes a folder name as an argument, and if it's not null, it fetches all the messages in that
   * folder, and for each message, it parses the header and body, and then calls the mineMessage function
   * @param {object} folder - The folder to mine.
   */
  mineMessages(folder, folderName) {
    let self = this;

    if (folder) {
      this.currentTotal = folder.messages.total;
      logger.debug(
        `Mining folder size: ${folder.messages.total} for User: ${this.mailHash}`
      );
      this.sends = inputHelpers.EqualPartsForSocket(folder.messages.total);
      // fetch function : pass fileds to fetch
      const f = this.connection.seq.fetch("1:*", {
        bodies: self.fields,
        struct: true,
      });
      logger.debug(
        `Fetch method using bodies ${self.fields} for User: ${this.mailHash}`
      );
      f.on("message", (msg, seqNumber) => {
        let Header = "";
        let body = "";
        let size = 0;
        msg.on("body", function (stream, streamInfo) {
          // parse the chunks of the message
          size += streamInfo.size;
          stream.on("data", async (chunk) => {
            if (streamInfo.which.includes("HEADER")) {
              Header += chunk.toString("utf8");
            } else {
              body += chunk;
            }
          });
        });
        msg.once("end", function () {
          self.pushMessageToQueue(seqNumber, Header, body, folderName);
        });
      });
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
    } else if (this.folders.indexOf(folderName) + 1 == this.folders.length) {
      logger.debug(`Done for User: ${this.mailHash}`);
      this.connection.end();
      self = null;
    } else {
      // if this folder is juste a label then pass to the next folder
      logger.debug(
        `Going to next folder, this one is undefined or a label in folders array for User: ${this.mailHash}`
      );
      this.mineFolder(
        this.folders[this.folders.indexOf(folderName) + 1]
      ).next();
      self = null;
    }
  }

  /**
   * Takes the seuence message number, the part it's being mined and the date in case of a body
   * then it will retrieve from one element redis queues and mine the create the message
   * @param seqNumber - The sequence number of the block that is being mined.
   * @param type - "body" or "header"
   * @param dateInCaseOfBody - This is the date of the body that is being mined.
   */
  async getMessageFromQueue(seqNumber, type, dateInCaseOfBody) {
    if (type == "body") {
      redisClient.rPop("bodies").then((data) => {
        this.mineMessage(seqNumber, 0, undefined, data, dateInCaseOfBody);
      });
    } else {
      redisClient.rPop("headers").then((data) => {
        if (data) {
          this.mineMessage(seqNumber, 0, JSON.parse(data), undefined, "");
        }
      });
    }
  }
  /**
   * It pushes the message to the queue and then calls the getMessageFromQueue function to get the
   * message from the queue asynchronously
   * @param seqNumber - The sequence number of the message
   * @param Header - The header of the email
   * @param Body - The body of the email
   * @param folderName - The name of the folder that the message is in.
   */
  async pushMessageToQueue(seqNumber, header, Body, folderName) {
    let Header = Imap.parseHeader(header);
    if (this.sends.includes(seqNumber)) {
      this.sendMiningProgress(seqNumber, folderName);
    }
    let message_id = Header["message-id"] ? Header["message-id"][0] : "";
    setTimeout(() => {
      redisClient.sIsMember("messages", message_id).then((alreadyMined) => {
        if (!alreadyMined) {
          if (Body && Body != "") {
            redisClient.lPush("bodies", Body).then((reply) => {
              this.getMessageFromQueue(
                seqNumber,
                "body",
                Header["date"] ? Header["date"][0] : ""
              );
            });
          }
          if (Header && Header != "") {
            redisClient
              .lPush("headers", JSON.stringify(Header))
              .then((reply) => {
                this.getMessageFromQueue(seqNumber, "header", "");
              });
          }
        }
      });
    }, 100);
  }

  /**
   * The function takes in a sequence number, header, and body of an email message, creates an
   * EmailMessage object, extracts email objects from the header and body, merges the two arrays of
   * email objects, and then updates the batch array
   * @param seqNumber - The sequence number of the email message.
   * @param header - the header of the email message
   * @param body - the body of the email message
   */
  async mineMessage(size, seqNumber, header, body, dateInCaseOfBody) {
    // create EmailMessage object
    let message = new EmailMessage(
      seqNumber,
      size,
      header,
      body,
      this.user,
      dateInCaseOfBody
    );
    let message_id = message.getMessageId();
    redisClient.sIsMember("messages", message_id).then((alreadyMined) => {
      if (!alreadyMined) {
        if (message_id) {
          redisClient.sAdd("messages", message_id).then(() => {
            message.extractEmailObjectsFromHeader();
            message.extractEmailObjectsFromBody();
          });
        }
      }
    });
  }

  /**
   * It takes an array of objects, checks if the object exists in the database, if it does, it updates
   * the object, if it doesn't, it creates a new object
   * @param batch - The array of objects that you want to store in the database.
   */
  async sendMiningProgress(seqNumber, folderName) {
    let used = process.memoryUsage().heapUsed / 1024 / 1024;
    logger.debug(`Used Memory ${used} mb`);
    if (Math.round(used * 100) / 100 > 190) {
      logger.debug(`Used Memory ${used} is high...forcing garbage collector`);
      global.gc();
    }
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
    if (this.sends.indexOf(seqNumber) % 2 == 0) {
      let minedEmails = await databaseHelpers.getEmails(this.user.id);
      let totalScanned = await databaseHelpers.getCountDB(this.user.id);
      this.sse.send(
        {
          data: inputHelpers.sortDatabase(minedEmails),
          totalScanned: totalScanned,
        },
        `minedEmails${this.user.id}`
      );
      logger.info(
        `${minedEmails.length} mined emails for user ${this.mailHash}`
      );
    }
    return;
  }
}

module.exports = EmailAccountMiner;
