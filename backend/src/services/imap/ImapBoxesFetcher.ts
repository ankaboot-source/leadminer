import {
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
    const connection = await this.imapConnectionsProvider.acquireConnection();

    const tree = await connection.list({
      statusQuery: { messages: true }
    });

    return buildFinalTree(createFlatTreeFromImap(tree), userEmail);
  }
}
