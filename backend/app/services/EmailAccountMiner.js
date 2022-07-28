const dataStructureHelpers = require("../utils/dataStructureHelpers");
const hashHelpers = require("../utils/hashHelpers");
const databaseHelpers = require("../utils/databaseHelpers");
const inputHelpers = require("../utils/inputHelpers");
const MAX_BATCH_SIZE = process.env.MAX_BATCH_SIZE;
const EmailMessage = require("./EmailMessage");
const Imap = require("imap");
const logger = require("../utils/logger")(module);
const redisClient = require("../../redis");

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
      return tree;
    });
  }

  /**
   * It connects to the IMAP server, and then calls the mineFolder() function on the first folder in the
   * folders array
   */
  async mine() {
    this.mineFolder(this.fields, this.folders);
    // init the connection using the user info (name, host, port, password, token...)
    this.connection.initConnection();
    this.connection = await this.connection.connecte();
    this.connection.once("ready", async () => {
      logger.info(`Begin mining emails messages for user: ${this.mailHash}`);
      this.mineFolder(this.folders[0]).next();
    });

    // cacelation using req.close evnt from user(frontend button)
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
      logger.debug(
        `Opening mail box folder: ${openedFolder} for User: ${this.mailHash}`
      );
      this.mineMessages(openedFolder, folder);
    });
  }

  /**
   * It takes a folder name as an argument, and if it's not null, it fetches all the messages in that
   * folder, and for each message, it parses the header and body, and then calls the mineBatch function
   * @param {object} folder - The folder to mine.
   */
  mineMessages(folder, folderName) {
    let self = this;
    let Header = "";
    let body = "";
    let size = 0;

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
        msg.on("body", function (stream, streamInfo) {
          // parse the chunks of the message
          size += streamInfo.size;
          stream.on("data", (chunk) => {
            if (streamInfo.which.includes("HEADER")) {
              Header += chunk;
            } else {
              body += chunk;
            }
          });
        });
        msg.once("end", function () {
          self.fetchMessages(seqNumber, Header, body, folderName);
          // if (self.sends.includes(seqNumber)) {
          //   setTimeout(() => {
          //     logger.debug(
          //       `Timeout of 4000ms to let GC make some work User: ${this.mailHash}`
          //     );
          //   }, 4000);
          //   self.sendBatch(seqNumber);
          // }
          // this will work only on headers
          // self.mineBatch(
          //   seqNumber,
          //   size,
          //   Imap.parseHeader(Header.toString("utf8")),
          //   undefined
          // );
          // store body in redis

          //redisClient.set(seqNumber.toString(), body);
          Header = "";
          body = "";
          size = 0;
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

  async minemessages(seqNumber, type, data) {
    if (type == "body") {
      redisClient.rPop("bodies").then(async (data) => {
        await this.mineBatch(seqNumber, 0, undefined, data).then(() => {
          // console.log(typeof data == "object" ? data : "");
          redisClient.lRem("bodies", 1, data);
        });
      });
    } else {
      redisClient.rPop("headers").then(async (data) => {
        await this.mineBatch(
          seqNumber,
          0,
          Imap.parseHeader(data),
          undefined
        ).then(() => {
          // console.log(typeof data == "object" ? data : "");
          redisClient.lRem("headers", 1, data);
        });
      });
    }
  }
  async fetchMessages(seqNumber, Header, Body, folderName) {
    if (this.sends.includes(seqNumber)) {
      this.sendBatch(seqNumber, folderName);
    }
    if (Body && Body != "") {
      await redisClient.lPush("bodies", Body).then((reply) => {
        this.minemessages(seqNumber, "body");
      });
    }
    if (Header && Header != "") {
      await redisClient.lPush("headers", Header).then((reply) => {
        this.minemessages(seqNumber, "header");
      });
    }
    // await redisClient.lPush("header", Header).then((reply) => {
    //   console.log("Queue Length headers", reply);
    //   this.minemessages(seqNumber);
    // });
  }
  /**
   * The function takes in a sequence number, header, and body of an email message, creates an
   * EmailMessage object, extracts email objects from the header and body, merges the two arrays of
   * email objects, and then updates the batch array
   * @param seqNumber - The sequence number of the email message.
   * @param header - the header of the email message
   * @param body - the body of the email message
   */
  async mineBatch(size, seqNumber, header, body) {
    // create EmailMessage object
    let message = new EmailMessage(seqNumber, size, header, body, this.user);
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
  async sendBatch(seqNumber, folderName) {
    let used = process.memoryUsage().heapUsed / 1024 / 1024;
    logger.debug(`Used Memory ${used} mb`);
    if (Math.round(used * 100) / 100 > 220) {
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
    let minedEmails = await databaseHelpers.getEmails(this.user.id);
    this.sse.send(
      {
        data: inputHelpers.sortDatabase(minedEmails),
      },
      `minedEmails${this.user.id}`
    );
    logger.info(`${minedEmails.length} mined emails for user ${this.mailHash}`);
    return;
  }
}

module.exports = EmailAccountMiner;
