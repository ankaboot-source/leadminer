import {
  addTotalPerFolder,
  buildFinalTree,
  createFlatTreeFromImap
} from '../../utils/helpers/imapTreeHelpers';
import ImapConnectionProvider from './ImapConnectionProvider';

export default class ImapBoxesFetcher {
  constructor(
    private readonly imapConnectionsProvider: ImapConnectionProvider
  ) {}

  /**
   * Retrieves the IMAP tree of the email account.
   * @returns IMAP tree.
   */
  async getTree(userEmail: string) {
    const imapConnection =
      await this.imapConnectionsProvider.acquireConnection();

    return new Promise((resolve, reject) => {
      imapConnection.getBoxes('', async (err, boxes) => {
        if (err) {
          reject(err);
        }
        const treeWithPaths = createFlatTreeFromImap(boxes);
        await addTotalPerFolder(treeWithPaths, imapConnection);
        const tree = buildFinalTree(treeWithPaths, userEmail);

        this.imapConnectionsProvider.releaseConnection(imapConnection);
        resolve(tree);
      });
    });
  }
}
