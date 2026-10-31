import { ImapFlow as Connection } from 'imapflow';
import { Logger } from 'winston';
import {
  buildFinalTree,
  createFlatTreeFromImap
} from '../../utils/helpers/imapTreeHelpers';

export default class ImapBoxesFetcher {
  constructor(
    private readonly imapConnection: Connection,
    private readonly logger: Logger
  ) {}

  /**
   * Retrieves the IMAP tree of the email account.
   * @returns IMAP tree.
   */
  async getTree(userEmail: string) {
    const tree = await this.imapConnection.list({
      statusQuery: { messages: true }
    });

    return buildFinalTree(createFlatTreeFromImap(tree), userEmail);
  }
}
