const dataStructureHelpers = require("../utils/dataStructureHelpers");
const hashHelpers = require("../utils/hashHelpers");
const { emailsInfos } = require("../models");
const MAX_BATCH_SIZE = process.env.MAX_BATCH_SIZE;
const EmailMessage = require("./EmailMessage");
const Imap = require("imap");
const logger = require("../utils/logger")(module);

class EmailAccountMiner {
  //public field
  tree = [];
  EmailsMessagesBatch = [];
  currentTotal = 0;

  /**
   * This function is a constructor for the class `EmailAccountMiner`
   * @param {object} connection - The connection to the imapserver.
   * @param {object} user - The user object that is currently associated with the connection.
   * @param {object} redisClient - The redis client.
   * @param {object} sse - The SSE object that will be used to send the data to the client.
   * @param {array} fields - An array of fields to be used in the fetch.
   * @param {array} folders - An array of folder paths to fetch from.
   * @param {object} cursor - The cursor is the current fetch position.
   * @param {number} batch_size - The number of records to dtore in each batch.
   */
  constructor(
    connection,
    user,
    redisClient,
    sse,
    fields,
    folders,
    cursor,
    batch_size,
    eventEmitter
  ) {
    this.connection = connection;
    this.user = user;
    this.redisClient = redisClient;
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
    const self = this;
    // cacelation using req.close evnt from user(frontend button)
    this.eventEmitter.on("endByUser", () => {
      self.connection.end();
    });
    this.connection.once("end", function () {
      logger.info(`End collecting emails for user: ${self.mailHash}`);
      // sse here to send data based on end event
      self.sse.send(true, "data");
      self.sse.send(true, "dns");
      self.eventEmitter.emit("end", true);
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
      this.mineMessages(openedFolder, folder);
    });
  }

  /**
   * It takes a folder name as an argument, and if it's not null, it fetches all the messages in that
   * folder, and for each message, it parses the header and body, and then calls the mineBatch function
   * @param {object} folder - The folder to mine.
   */
  mineMessages(folder, folderName) {
    const self = this;
    if (folder) {
      this.currentTotal = folder.messages.total;
      // fetch function : pass fileds to fetch
      const f = this.connection.seq.fetch("1:*", {
        bodies: self.fields,
        struct: true,
      });
      f.on("message", (msg, seqNumber) => {
        let bufferHeader = "";
        let bufferBody = "";
        let size = 0;
        msg.on("body", async function (stream, streamInfo) {
          // parse the chunks of the message
          size = streamInfo.size;
          stream.on("data", (chunk) => {
            if (streamInfo.which.includes("HEADER")) {
              bufferHeader += chunk;
            } else {
              bufferBody += chunk;
            }
          });
        });
        msg.once("end", function () {
          // mine batch to treate this mined message
          self.mineBatch(
            seqNumber,
            size,
            Imap.parseHeader(bufferHeader.toString("utf8")),
            bufferBody
          );
        });
      });
      f.once("end", () => {
        logger.info(
          `End mining email messages from folder:${folder.name} for user: ${this.mailHash}`
        );
        if (self.folders.indexOf(folder.name) + 1 == self.folders.length) {
          // we are at the end of the folder array==>> end imap connection
          this.connection.end();
        } else {
          // go to the next folder
          self
            .mineFolder(self.folders[self.folders.indexOf(folder.name) + 1])
            .next();
        }
      });
    } else {
      // if this folder is juste a label then pass to the next folder
      this.mineFolder(
        this.folders[this.folders.indexOf(folderName) + 1]
      ).next();
    }
  }
  /**
   * The function takes in a sequence number, header, and body of an email message, creates an
   * EmailMessage object, extracts email objects from the header and body, merges the two arrays of
   * email objects, and then updates the batch array
   * @param seqNumber - The sequence number of the email message.
   * @param header - the header of the email message
   * @param body - the body of the email message
   */
  mineBatch(size, seqNumber, header, body) {
    // create EmailMessage object
    const message = new EmailMessage(seqNumber, size, header, body, this.user);
    // extract the header
    const emailsObjectsFromHeader = message.extractEmailObjectsFromHeader();
    // extract the body
    const emailsObjectsFromBody = message.extractEmailObjectsFromBody();
    const emailsObjectsFromHeaderAndBody = [
      ...emailsObjectsFromHeader,
      ...emailsObjectsFromBody,
    ];
    // update batch array
    this.EmailsMessagesBatch.push(
      //...dataStructureHelpers.mergeEmailsObjectsFromHeaderAndBodyToBatch(
      ...emailsObjectsFromHeaderAndBody
      //)
    );
    // TODO: dynamic batch size based on scanned folder length
    // if batch length is up to 100 then store to database
    if (
      this.currentTotal > this.batch_size &&
      this.EmailsMessagesBatch > this.batch_size
    ) {
      // remerge not required TODO: to remove after verification
      const batchTobeStored =
        dataStructureHelpers.mergeEmailsObjectsFromHeaderAndBodyToBatch(
          this.EmailsMessagesBatch
        );
      this.EmailsMessagesBatch = [];

      this.storeBatch(batchTobeStored);
    }
  }

  /**
   * It takes an array of objects, checks if the object exists in the database, if it does, it updates
   * the object, if it doesn't, it creates a new object
   * @param batch - The array of objects that you want to store in the database.
   */
  storeBatch(batch) {
    //logger.info(`Saving/updating data for user: ${this.mailHash}`);
    const batchArray = [];
    const promises = [];
    batch.forEach(async (emailObject) => {
      emailObject["user"] = this.user.email;
      if (emailObject.address) {
        promises.push(
          new Promise((res, rej) => {
            // search in database before storing
            emailsInfos
              .findOne({
                where: { address: emailObject.address },
              })
              .then((email) => {
                if (email) {
                  const emailObj = email.dataValues;
                  if (
                    emailObject.messageId.every((element) => {
                      return emailObj.messageId.includes(element);
                    }) == false
                  ) {
                    // if found then update the mail infos
                    const updatedEmailObject = this.updateEmailObject(
                      emailObject,
                      emailObj
                    );

                    batchArray.push(updatedEmailObject);
                    res();
                  } else {
                    res("exists");
                  }
                } else {
                  batchArray.push(emailObject);
                  res();
                }
              });
          })
        );
      }
    });
    // wait for all promise then store in database
    Promise.all(promises).then((result) => {
      if (batchArray.length > 0) {
        // create the new data
        emailsInfos.bulkCreate(batchArray, {
          updateOnDuplicate: ["fields", "name", "messageId"],
        });
      }
    });
  }

  /**
   * It takes two objects, one with the new data and one with the stored object, and merges the new data into
   * the stored object.
   * @param emailObject - The email object that is being added to the store.
   * @param emailObjectInStore - The email object that is already in the store.
   * @returns the emailObjectInStore.
   */
  updateEmailObject(emailObject, emailObjectInStore) {
    // push the new message ids
    emailObjectInStore["messageId"].push(...emailObject.messageId);
    Object.keys(emailObject).map((key) => {
      if (
        key == "name" &&
        !emailObjectInStore.name.includes(emailObject.name)
      ) {
        emailObjectInStore[
          key
        ] = `${emailObjectInStore[key]} || ${emailObject[key]}`;
      }
      if (key == "fields") {
        // update/create new fields
        Object.keys(emailObject.fields).map((fieldName) => {
          if (!Object.keys(emailObjectInStore.fields).includes(fieldName)) {
            emailObjectInStore.fields[fieldName] =
              emailObject.fields[fieldName];
          } else {
            emailObjectInStore.fields[fieldName] =
              emailObjectInStore.fields[fieldName] +
              emailObject.fields[fieldName];
          }
        });
      }
      if (key == "type") {
        // update type
        emailObjectInStore.type.push(...emailObject.type);
        emailObjectInStore.type = [...new Set(emailObjectInStore.type)];
      }
      if (key == "engagement") {
        // update engagement number
        emailObjectInStore.engagement += emailObject.engagement;
      }
    });
    return emailObjectInStore;
  }
}

module.exports = EmailAccountMiner;
