const imapTreeHelpers = require('../utils/helpers/imapTreeHelpers');

class ImapBoxesFetcher {
  #imapConnectionsProvider;

  constructor(imapConnectionsProvider) {
    this.#imapConnectionsProvider = imapConnectionsProvider;
  }

  /**
   * Retrieves the IMAP tree of the email account.
   * @returns {Promise<object>} IMAP tree.
   */
  async getTree() {
    const imapConnection =
      await this.#imapConnectionsProvider.acquireConnection();

    return new Promise((resolve, reject) => {
      imapConnection.getBoxes('', async (err, boxes) => {
        if (err) {
          reject(err);
        }
        const treeWithPaths = imapTreeHelpers.createFlatTreeFromImap(boxes);
        await imapTreeHelpers.addTotalPerFolder(treeWithPaths, imapConnection);
        const tree = imapTreeHelpers.buildFinalTree(
          treeWithPaths,
          // eslint-disable-next-line no-underscore-dangle
          imapConnection._config.user
        );

        this.#imapConnectionsProvider.releaseConnection(imapConnection);
        resolve(tree);
      });
    });
  }
}

module.exports = {
  ImapBoxesFetcher
};
