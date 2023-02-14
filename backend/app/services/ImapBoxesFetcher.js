const imapTreeHelpers = require('../utils/helpers/imapTreeHelpers');

class ImapBoxesFetcher {
  #imapConnectionsProvider;

  constructor(imapConnectionsProvider) {
    this.#imapConnectionsProvider = imapConnectionsProvider;
  }

  /**
   * Gets the total number of messages per folder
   * @param {{label: string, path: string}[]} folders - flat array of objects.
   * @param {Imap} imapConnection - An IMAP connection.
   * @returns {Promise}
   */
  addTotalPerFolder(folders, imapConnection) {
    const promises = folders.map((folder) => {
      return new Promise((resolve, reject) => {
        imapConnection.status(folder.path, (err, box) => {
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
  async getTree() {
    const imapConnection =
      await this.#imapConnectionsProvider.acquireConnection();
    return new Promise((resolve, reject) => {
      imapConnection.once('ready', () => {
        imapConnection.getBoxes('', async (err, boxes) => {
          if (err) {
            reject(err);
          }
          const treeWithPaths = imapTreeHelpers.createFlatTreeFromImap(boxes);
          await this.addTotalPerFolder(treeWithPaths, imapConnection);
          const tree = imapTreeHelpers.buildFinalTree(
            treeWithPaths,
            imapConnection._config.user
          );

          this.#imapConnectionsProvider.releaseConnection(imapConnection);
          resolve(tree);
        });
      });

      imapConnection.once('error', (error) => {
        this.#imapConnectionsProvider.releaseConnection(imapConnection);
        reject(error);
      });

      imapConnection.connect();
    });
  }
}

module.exports = {
  ImapBoxesFetcher
};
