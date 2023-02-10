const imapTreeHelpers = require('../utils/helpers/imapTreeHelpers');

class ImapBoxesFetcher {
  constructor(imapConnectionProvider) {
    this.imapConnection = imapConnectionProvider.getImapConnection();
  }

  /**
   * Gets the total number of messages per folder
   * @param {{label: string, path: string}[]} folders - flat array of objects.
   * @returns {Promise}
   */
  addTotalPerFolder(folders) {
    const promises = folders.map((folder) => {
      return new Promise((resolve, reject) => {
        this.imapConnection.status(folder.path, (err, box) => {
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
   * Retrieves the IMAP tree of the email account.
   * @returns {Promise<object>} IMAP tree.
   */
  getTree() {
    return new Promise((resolve, reject) => {
      this.imapConnection.once('ready', () => {
        this.imapConnection.getBoxes('', async (err, boxes) => {
          if (err) {
            reject(err);
          }
          const treeWithPaths = imapTreeHelpers.createFlatTreeFromImap(boxes);
          await this.addTotalPerFolder(treeWithPaths);
          const tree = imapTreeHelpers.buildFinalTree(
            treeWithPaths,
            this.imapConnection._config.user
          );

          this.imapConnection.end();
          this.imapConnection.removeAllListeners();

          resolve(tree);
        });
      });

      this.imapConnection.once('error', (error) => {
        this.imapConnection.removeAllListeners();
        reject(error);
      });

      this.imapConnection.connect();
    });
  }
}

module.exports = {
  ImapBoxesFetcher
};
