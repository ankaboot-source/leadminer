const dataStructureHelpers = require("../utils/dataStructureHelpers");
const MAX_BATCH_SIZE = process.env.MAX_BATCH_SIZE;
class EmailAccountMiner {
  tree = [];
  constructor(connection, fields, cursor, batch_size) {
    this.connection = connection;
    this.fields = fields;
    this.cursor = cursor;
    this.batch_size = batch_size || MAX_BATCH_SIZE;
  }
  get tree() {
    return this.tree;
  }
  set tree(imapTree) {
    this.tree = imapTree;
  }

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
          this.tree = treeWithPaths;
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
  getTreeWithTotalPerFolder(treeimap) {
    return new Promise((resolve, reject) => {
      treeimap.map((folder) => {
        if (folder.hasOwnProperty("children")) {
          this.connection.openBox(folder.path, true, (err, box) => {
            if (box) {
              folder["total"] = box.messages.total;
            } else {
              folder["total"] = 0;
            }

            if (folder == treeimap[treeimap.length - 1]) {
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
            if (folder == treeimap[treeimap.length - 1]) {
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
  refreshTree() {
    // refresh tree from imap
  }
  mine() {
    // implements a for loop to go through all folders
    // it calls this.mineFolder()
  }
  mineFolder(folder) {
    // for a given folder name, mine messages
    //calls mineBatch
  }
  mineBatch() {
    // recieves two params cursor and EmailMessage object
    // after using emails = EmailMessage.extractEmailAddressesFromHeader()
    // calls helpers like isNoReply(), isNewsletter(), isInConversation() on each element in emails
    // then push to emailsArray . if emailsArray.length > batch_size then store new emails and
    // update old ones(we will use redis to check if already mined address) in database, else
    // update emailsArray if alreadyMined(emailAddress) == true (this address already mined and we need only an update)
  }
}

module.exports = EmailAccountMiner;
