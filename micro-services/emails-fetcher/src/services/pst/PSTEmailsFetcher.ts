import * as fs from 'fs';
import { parseHeader } from 'imap';
import path from 'path';
import { PSTFile, PSTFolder, PSTMessage } from 'pst-extractor';
import { getMessageId } from '../../utils/helpers/emailHeaderHelpers';
import hashEmail from '../../utils/helpers/hashHelpers';
import logger from '../../utils/logger';
import redis from '../../utils/redis';
// import { parseHeader } from 'imap';

const redisClient = redis.getClient();

interface StreamEmailData {
  header: Record<string, string[]>;
  body: string;
  seqNumber: number;
  folderPath: string;
  isLast: boolean;
}

interface StreamSignatureData {
  header: {
    from: { address?: string; name?: string };
    messageId: string;
    messageDate: Date;
    rawHeader: Record<string, string[]>;
  };
  body: string;
  seqNumber: number;
  folderPath: string;
  isLast: boolean;
}

interface EmailToStream {
  miningId: string;
  type: 'email' | 'signature';
  data: StreamEmailData | StreamSignatureData;
  userId: string;
  userEmail: string;
  userIdentifier: string;
}

/**
 * Publishes the fetching progress for a mining task to redis PubSub.
 * @param miningId - The ID of the mining job.
 * @param fetchedMessagesCount - The number of messages fetched so far.
 */
async function publishFetchingProgress(
  miningId: string,
  fetchedMessagesCount: number,
  isCanceled: boolean,
  isCompleted: boolean
) {
  const progress = {
    miningId,
    count: fetchedMessagesCount,
    progressType: 'fetched',
    isCompleted,
    isCanceled
  };

  // Publish a progress with how many messages we fetched.
  await redisClient.publish(miningId, JSON.stringify(progress));
}

/**
 * Publishes an email payload to a Redis stream.
 *
 * @async
 * @function publishToStream
 * @param {string} stream - The name of the Redis stream to publish to.
 * @param {EmailToStream} data - The email data to be published. This object is serialized to JSON.
 * @throws {Error} If the Redis `xadd` operation fails, the error is logged and rethrown.
 * @returns {Promise<void>} Resolves when the message has been successfully added to the stream.
 */
async function publishToStream(stream: string, data: EmailToStream) {
  try {
    await redisClient.xadd(stream, '*', 'message', JSON.stringify(data));
  } catch (err) {
    logger.error('Error when publishing to streams');
    throw err;
  }
}

export default class PSTEmailsFetcher {
  public isCanceled: boolean;

  public isCompleted: boolean;

  private totalFetched: number;

  private readonly processSetKey: string;

  private readonly userIdentifier: string;

  private readonly fetchedIds: Set<string>;

  private readonly userEmail: string = '';

  /**
   * Constructor for EmailsFetcher.
   * @param userId - The unique identifier of the user.
   * @param miningId - The unique identifier of the mining process.
   * @param streamName - The name of the stream to write fetched emails.
   * @param fetchEmailBody - Whether to fetch email body or not.
   */
  constructor(
    private readonly userId: string,
    private readonly miningId: string,
    private readonly contactStream: string,
    private readonly signatureStream: string,
    private readonly fetchEmailBody: boolean
  ) {
    // Generate a unique identifier for the user.
    this.userIdentifier = hashEmail(this.userEmail, userId);
    // Set the key for the process set. used for caching.
    this.processSetKey = `caching:${miningId}`;

    // Fetching state
    this.totalFetched = 0;
    this.isCanceled = false;
    this.isCompleted = false;

    this.fetchedIds = new Set<string>();
  }

  async publishHeader(
    header: Record<string, string[]>,
    seq: number,
    isLastMessageInFolder: boolean,
    folder: string
  ): Promise<Record<string, string[]> | null> {
    try {
      const messageId = getMessageId(header);
      header['message-id'] = [messageId];

      const skipThisEmail =
        !header || (this.fetchedIds.has(messageId) && !isLastMessageInFolder);

      if (skipThisEmail) return null;

      await publishToStream(this.contactStream, {
        type: 'email',
        data: {
          header,
          body: '',
          seqNumber: seq,
          folderPath: folder,
          isLast: isLastMessageInFolder
        } as StreamEmailData,
        userId: this.userId,
        userEmail: this.userEmail,
        userIdentifier: this.userIdentifier,
        miningId: this.miningId
      });

      return header ?? null;
    } catch (error) {
      logger.error('Error when publishing email header', { error });
      throw error;
    }
  }

  /**
   * Starts fetching email messages.
   */

  private async notifyCompleted() {
    // Notify signature worker fetching is ended
    await redisClient.xadd(
      this.signatureStream,
      '*',
      'message',
      JSON.stringify({
        type: '',
        data: {
          header: {},
          body: '',
          seqNumber: -1,
          folderPath: '',
          isLast: true
        },
        userId: this.userId,
        userEmail: this.userEmail,
        userIdentifier: this.userIdentifier,
        miningId: this.miningId
      })
    );

    logger.info(
      `[${this.miningId}] Notified signature stream: This is the last published message.`
    );

    await publishFetchingProgress(
      this.miningId,
      0,
      this.isCanceled,
      this.isCompleted
    );

    logger.info(
      `[${this.miningId}] Notified progress: Fetching is ${
        this.isCanceled ? 'canceled' : 'stopped'
      } with total fetched: ${this.totalFetched}`
    );
  }

  private async cleanup() {
    await redisClient.unlink(this.processSetKey);
    logger.debug(
      `Cleaned redis cache with id: ${this.processSetKey} and imap pool`
    );
  }

  /**
   * Performs cleanupConnections operations after the fetching process has finished or stopped.
   */
  async stop(cancel: boolean) {
    if (cancel) {
      this.isCanceled = true;
      logger.debug(`[${this.miningId}] Triggered cancel`);
    }

    try {
      logger.debug(`[${this.miningId}] Awaited email queue to idle`);
      await this.cleanup();
      await this.notifyCompleted();
      return this.isCompleted;
    } catch (error) {
      logger.error(`[${this.miningId}] Error during stop process:`, error);
      await this.cleanup();
      await this.notifyCompleted();
      throw error;
    }
  }

  /**
   * Walk the folder tree recursively and process emails.
   * @param {PSTFolder} folder
   */
  processFolder(folder: PSTFolder): void {
    // go through the folders...
    if (folder.hasSubfolders) {
      const childFolders: PSTFolder[] = folder.getSubFolders();
      for (const childFolder of childFolders) {
        this.processFolder(childFolder);
      }
    }

    // and now the emails for this folder
    if (folder.contentCount > 0) {
      let seq = 0;
      let email: PSTMessage = folder.getNextChild();
      while (email != null) {
        seq++;
        const { body, transportMessageHeaders } = email;
        const headers = parseHeader(transportMessageHeaders);
        const isLastMessageInFolder = seq === folder.emailCount; // .contentCount

        this.publishHeader(
          headers,
          seq,
          isLastMessageInFolder,
          folder.displayName
        );

        email = folder.getNextChild();
      }
    }
  }

  start() {
    const filename = 'Deals.pst'; // .ost

    const ANSI_YELLOW = 93;
    const highlight = (str: string, code: number) =>
      '\u001b[' + code + 'm' + str + '\u001b[0m';
    // Deals.pst have some message prints: PSTUtil::createAppropriatePSTMessageObject unknown message type: IPM.Note.EAS

    const start = Date.now();
    const pstFile = new PSTFile(
      fs.readFileSync(path.join(__dirname, filename))
    );
    console.log(pstFile.getMessageStore().displayName);
    this.processFolder(pstFile.getRootFolder());

    const end = Date.now();
    console.log(
      highlight(
        filename + ' processed in ' + (end - start) + ' ms',
        ANSI_YELLOW
      )
    );
  }
}
