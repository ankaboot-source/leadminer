const dataStructureHelpers = require("../utils/dataStructureHelpers");
const persistentEmails = require("../models/emails.model");
const MAX_BATCH_SIZE = process.env.MAX_BATCH_SIZE;
const EmailMessage = require("./EmailMessage");
const Imap = require("imap");

class EmailAccountMiner {
  //public field
  tree = [];
  temporaryEmailsMessagesArray = [];
  /**
   * Create EmailAccountMiner object
   * @param  {object} connection - Imap connection
   * @param  {object} user - current imap user
   * @param  {object} redisClient - client for redis
   * @param  {object} sse - server sent event instance
   * @param  {array} fields - fields to be mined (TO,From,cc...)
   * @param  {array} folders - full paths to folders to be mined (INBOX, spam, sent, trash...)
   * @param  {object} cursor - position in imap mining
   * @param  {number} batch_size - batsh size value
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
   * Uses the connection to connect to imap server then fetch the imap tree.
   * @async
   * @returns {Promise<object>} The imap tree
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
   * for each folder it calculates the total field.
   * @param  {} treeimap - imap tree.
   * @returns {Promise<object>} imap tree with total field per folder.
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
   * Connects to imap and calls a generator method on each folder
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
   * For a given folder name, mine messages
   * @param  {string} folder - folder name to be mined
   */
  *mineFolder(folder) {
    yield this.connection.openBox(folder, true, async (err, openedFolder) => {
      this.mineMessages(openedFolder);
    });
  }
  /**
   * For a given folder name mineMessage fetch a message and
   * parse the header and the body of the message
   * @param  {string} folder - folder name to be mined
   */
  mineMessages(folder) {
    let self = this;
    if (folder) {
      const f = this.connection.seq.fetch("1:*", {
        bodies: this.fields,
        struct: true,
      });
      f.on("message", (msg, seqNumber) => {
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
        self.mineFolder(self.folders[folders.indexOf(folder) + 1]).next();
      });
    } else {
      this.mineFolder(this.folders[folders.indexOf(folder) + 1]).next();
    }
  }
  /**
   * MineBatch will parse emails objects then call storeBatch()
   * @param  {} seqNumber - sequencial number of the mined message
   * @param  {} header - Message header
   * @param  {} body - message body
   */
  mineBatch(seqNumber, header, body) {
    let message = new EmailMessage(seqNumber, header, body);
    let emailsObjectsFromHeader = message.extractEmailObjectsFromHeader();
    let emailsObjectsFromBody = message.extractEmailObjectsFromBody();
    let mergedEmailsObjectsFromHeaderAndBody =
      dataStructureHelpers.mergeEmailsObjectsFromHeaderAndBody(
        emailsObjectsFromHeader,
        emailsObjectsFromBody
      );
    this.temporaryEmailsMessagesArray.push(
      mergedEmailsObjectsFromHeaderAndBody
    );
    if (this.temporaryEmailsMessagesArray.length > this.batch_size) {
      this.storeBatch();
    }
  }
  /**
   * storeBatch will update the database with the given batch array
   */
  storeBatch() {
    let bulkArray = [];
    this.temporaryEmailsMessagesArray.forEach((emailObject) => {
      emailObject["user"] = this.user.email;
      persistentEmails
        .findOne({
          where: { user: emailObject.user, address: emailObject.address },
        })
        .then((email) => {
          if (email) {
            let updatedEmailObject = this.updateEmailObject(emailObject, email);
            bulkArray.push(updatedEmailObject);
          } else {
            bulkArray.push(emailObject);
          }
        });
    });
    persistentEmails.bulkCreate(bulkArray, {
      updateOnDuplicate: ["user", "email"],
    });
  }
  /**
   * updateEmailObject will update emailObjectInStore with new parsed emailObject fields
   * @param  {} emailObject - mined email object
   * @param  {} emailObjectInStore - email object that will be updated with new data
   */
  updateEmailObject(emailObject, emailObjectInStore) {
    Object.keys(emailObject).map((key) => {
      if (key == "name" && emailObject[key] != emailObjectInStore[key]) {
        emailobjectInStore[key] =
          emailObjectInStore + " || " + emailObject[key];
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
