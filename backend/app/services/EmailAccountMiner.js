const dataStructureHelpers = require("../utils/dataStructureHelpers");
const { emailsInfos } = require("../models");
const MAX_BATCH_SIZE = process.env.MAX_BATCH_SIZE;
const EmailMessage = require("./EmailMessage");
const Imap = require("imap");

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
    batch_size
  ) {
    this.connection = connection;
    this.user = user;
    this.redisClient = redisClient;
    this.sse = sse;
    this.fields = fields;
    this.folders = folders;
    this.cursor = cursor;
    this.batch_size = batch_size || MAX_BATCH_SIZE;
  }

  /**
   * It connects to the IMAP server, gets the tree of folders, adds the total number of emails per
   * folder, and then adds the total number of emails per parent folder
   * @async
   * @returns a promise that resolves to an array of two elements. The first element is the tree object,
   * the second element is an error object.
   */
  async getTree() {
    return new Promise((resolve, reject) => {
      let result = [];
      this.connection.connect();
      this.connection.once("ready", () => {
        this.connection.getBoxes("", async (err, boxes) => {
          let treeObjectWithChildrens =
            dataStructureHelpers.createReadableTreeObjectFromImapTree(boxes);
          let treeWithPaths = dataStructureHelpers.addPathPerFolder(
            treeObjectWithChildrens,
            treeObjectWithChildrens
          );
          await this.getTreeWithTotalPerFolder(treeWithPaths);
          this.tree = dataStructureHelpers.addChildrenTotalForParentFiles(
            treeWithPaths,
            this.user.email
          );
        });
      });
      this.connection.once("end", () => {
        result = [this.tree, null];
        resolve(result);
      });
      this.connection.once("error", (error) => {
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
          this.getTreeWithTotalPerFolder(folder.children);
        } else {
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
    // TODO : foldersNames : could be an array so we can get many folders trees at once at once
    let tree = {};
    let folderPath = dataStructureHelper.getFolderPathFromTreeObject(
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
  mine() {
    // implements a for loop to go through all folders
    // it calls this.mineFolder()
    this.mineFolder(this.fields, this.folders);
    this.connection.connect();
    this.connection.once("ready", async () => {
      this.mineFolder(this.folders[0]).next();
    });
  }
  /**
   * It opens a folder, and when it's done, it mines the messages in that folder
   * @param folder - The folder you want to mine.
   */
  *mineFolder(folder) {
    yield this.connection.openBox(folder, true, async (err, openedFolder) => {
      this.mineMessages(openedFolder);
    });
  }

  /**
   * It takes a folder name as an argument, and if it's not null, it fetches all the messages in that
   * folder, and for each message, it parses the header and body, and then calls the mineBatch function
   * @param {object} folder - The folder to mine.
   */
  mineMessages(folder) {
    let self = this;
    if (folder) {
      this.currentTotal = folder.messages.total;
      const f = this.connection.seq.fetch("1:*", {
        bodies: self.fields,
        struct: true,
      });
      f.on("message", (msg, seqNumber) => {
        this.cursor = seqNumber;
        let bufferHeader = "";
        let bufferBody = "";
        msg.on("body", async function (stream, streamInfo) {
          stream.on("data", (chunk) => {
            if (streamInfo.which.includes("HEADER")) {
              bufferHeader += chunk;
            } else {
              bufferBody += chunk;
            }
          });
        });
        msg.once("end", function () {
          self.mineBatch(
            seqNumber,
            Imap.parseHeader(bufferHeader.toString("utf8")),
            bufferBody
          );
        });
      });
      f.once("end", () => {
        console.log("end");

        if (
          self.folders.indexOf(folder) -
          self.folders.indexOf(self.folders[self.folders.length - 1] <= 0)
        ) {
          self
            .mineFolder(self.folders[self.folders.indexOf(folder) + 1])
            .next();
        } else {
          this.connection.end();
        }
      });
    } else {
      this.mineFolder(this.folders[folders.indexOf(folder) + 1]).next();
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
  mineBatch(seqNumber, header, body) {
    // create EmailMessage object
    let message = new EmailMessage(seqNumber, header, body, this.redisClient);
    let emailsObjectsFromHeader = message.extractEmailObjectsFromHeader();
    let emailsObjectsFromBody = message.extractEmailObjectsFromBody();
    let emailsObjectsFromHeaderAndBody = [
      ...emailsObjectsFromHeader,
      ...emailsObjectsFromBody,
    ];

    // update batch array
    this.EmailsMessagesBatch =
      dataStructureHelpers.mergeEmailsObjectsFromHeaderAndBodyToBatch(
        emailsObjectsFromHeaderAndBody,
        this.EmailsMessagesBatch
      );

    if (this.cursor == this.currentTotal) {
      let arraybatch =
        dataStructureHelpers.mergeEmailsObjectsFromHeaderAndBodyToBatch(
          [],
          this.EmailsMessagesBatch
        );

      this.EmailsMessagesBatch = [];
      this.storeBatch(arraybatch);
    }
  }

  /**
   * It takes an array of objects, checks if the object exists in the database, if it does, it updates
   * the object, if it doesn't, it creates a new object
   * @param array - The array of objects that you want to store in the database.
   */
  storeBatch(array) {
    let bulkArray = [];
    let promises = [];
    array.forEach(async (emailObject) => {
      emailObject["user"] = this.user.email;
      if (emailObject.address) {
        promises.push(
          new Promise((res, rej) => {
            emailsInfos
              .findOne({
                where: { address: emailObject.address },
              })
              .then((email) => {
                if (email) {
                  let emailObj = email.dataValues;
                  if (emailObj.messageId.includes(emailObject.messageId)) {
                    res("exists");
                  } else {
                    let updatedEmailObject = this.updateEmailObject(
                      emailObject,
                      emailObj
                    );
                    bulkArray.push(updatedEmailObject);
                    res();
                  }
                } else {
                  bulkArray.push(emailObject);
                  res();
                }
              });
          })
        );
      }
    });
    Promise.all(promises).then((result) => {
      emailsInfos.bulkCreate(bulkArray, {
        updateOnDuplicate: ["fields", "name"],
      });
    });
  }
  /**
   * updateEmailObject will update emailObjectInStore with new parsed emailObject fields
   * @param  {} emailObject - mined email object
   * @param  {} emailObjectInStore - email object that will be updated with new data
   */
  /**
   * It takes two objects, one with the new data and one with the stored object, and merges the new data into
   * the stored object.
   * @param emailObject - The email object that is being added to the store.
   * @param emailObjectInStore - The email object that is already in the store.
   * @returns the emailObjectInStore.
   */
  updateEmailObject(emailObject, emailObjectInStore) {
    Object.keys(emailObject).map((key) => {
      if (key == "name" && emailObject[key] != emailObjectInStore[key]) {
        emailObjectInStore[key] =
          emailObjectInStore[key] + " || " + emailObject[key];
      }
      if (key == "fields") {
        Object.keys(emailObject[key]).map((fieldName) => {
          if (emailObjectInStore[key][fieldName]) {
            emailObjectInStore[key][fieldName] =
              emailObjectInStore[key][fieldName] + emailObject[key][fieldName];
          } else {
            emailObjectInStore[key][fieldName] = emailObject[key][fieldName];
          }
        });
      }
    });
    return emailObjectInStore;
  }
}

module.exports = EmailAccountMiner;
