import { ImapFlow as Connection } from 'imapflow';
import { Logger } from 'winston';
import {
  buildFinalTree,
  createFlatTreeFromImap
} from '../../utils/helpers/imapTreeHelpers';
import { FolderWatermark } from './types';
import { EXCLUDED_IMAP_FOLDERS } from '../../utils/constants';

export default class ImapBoxesFetcher {
  constructor(
    private readonly imapConnection: Connection,
    private readonly logger: Logger
  ) {}

  /**
   * Retrieves the IMAP tree of the email account, annotated with each folder's
   * persisted watermark and derived sync status so callers (frontend) don't
   * have to compare UIDs themselves.
   * @param userEmail - mailbox owner
   * @param watermarks - `config.mining.last.folders` keyed by folder path
   * @returns IMAP tree.
   */
  async getTree(
    userEmail: string,
    watermarks: Record<string, FolderWatermark> = {}
  ) {
    const tree = await this.imapConnection.list({
      statusQuery: {
        messages: true,
        uidNext: true,
        uidValidity: true
      }
    });

    return buildFinalTree(createFlatTreeFromImap(tree, watermarks), userEmail);
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
