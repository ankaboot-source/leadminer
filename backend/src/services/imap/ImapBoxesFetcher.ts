import { ImapFlow as Connection } from 'imapflow';
import { Logger } from 'winston';
import {
  buildFinalTree,
  createFlatTreeFromImap
} from '../../utils/helpers/imapTreeHelpers';
import { EXCLUDED_IMAP_FOLDERS } from '../../utils/constants';

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

  /**
   * Fetches the total number of messages across the specified folders on an IMAP server.
   */
  async getTotalMessages(inboxes: string[]) {
    let total = 0;

    try {
      // Create an array of Promises that resolve to the total number of messages in each folder.
      const folders = inboxes.filter(
        (folder) => !EXCLUDED_IMAP_FOLDERS.includes(folder)
      );

      folders.forEach(async (folder) => {
        try {
          const status = await this.imapConnection?.status(folder, {
            messages: true
          });
          total += status?.messages ?? 0;
        } catch (err) {
          this.logger.warn(`Could not STATUS ${folder}`, err);
        }
      });
      return total;
    } catch (err) {
      this.logger.error('Failed fetching total messages', {
        folders: inboxes,
        error: err
      });
      throw err;
    }
  }
}
