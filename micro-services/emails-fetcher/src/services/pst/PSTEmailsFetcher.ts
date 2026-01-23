import * as fs from 'fs';
import { parseHeader } from 'imap';
import path from 'path';
import { PSTFile, PSTFolder, PSTMessage } from 'pst-extractor';
import { pipeline } from 'stream/promises';
import ENV from '../../config';
import { getMessageId } from '../../utils/helpers/emailHeaderHelpers';
import hashEmail from '../../utils/helpers/hashHelpers';
import logger from '../../utils/logger';
import redis from '../../utils/redis';
import supabaseClient from '../../utils/supabase';

const PST_FOLDER = 'pst';
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

  private publishedEmails: number;

  private readonly batchSize: number;

  private readonly processSetKey: string;

  private readonly userIdentifier: string;

  private readonly fetchedIds: Set<string>;

  private readonly userEmail: string;

  private localPstFilePath?: string;

  private pstFile?: PSTFile;

  public totalMessages = 0;

  private hasNotifiedCompleted = false;

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
    private readonly fetchEmailBody: boolean,
    private readonly source: string // userid/filename.ext
  ) {
    // Source workaround: Set the userEmail to the filename messages and extractors receive the original filename as the identifier.
    this.userEmail = this.source.split('/')[1];
    this.userIdentifier = hashEmail(this.userEmail, userId);

    // Set the key for the process set. used for caching.
    this.processSetKey = `caching:${miningId}`;

    // Fetching state
    this.totalFetched = 0;
    this.publishedEmails = 0;
    this.batchSize = ENV.FETCHING_BATCH_SIZE_TO_SEND;
    this.isCanceled = false;
    this.isCompleted = false;

    this.fetchedIds = new Set<string>();
  }

  async init() {
    await this.downloadPSTFromSupabase(this.source);
    return this;
  }

  async publishHeader(
    header: Record<string, string[]>,
    seq: number,
    isLastMessageInFolder: boolean,
    folder: string
  ): Promise<Record<string, string[]> | null> {
    try {
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

  async publishBody(
    body: string,
    header: Record<string, string[]>,
    seq: number,
    isLastMessageInFolder: boolean,
    folder: string,
    email: PSTMessage
  ) {
    const [messageId] = header['message-id'];

    const {
      senderEmailAddress: address,
      senderName: name,
      clientSubmitTime: messageDate
    } = email;

    try {
      await publishToStream(this.signatureStream, {
        type: 'signature',
        data: {
          header: {
            from: { address, name },
            messageId,
            messageDate,
            rawHeader: header
          },
          body,
          seqNumber: seq,
          folderPath: folder,
          isLast: isLastMessageInFolder
        } as StreamSignatureData,
        userId: this.userId,
        userEmail: this.userEmail,
        userIdentifier: this.userIdentifier,
        miningId: this.miningId
      });
    } catch (err) {
      logger.error('Error when publishing signature to stream', {
        error: err
      });
    }
  }

  /**
   * Starts fetching email messages.
   */

  private async notifyCompleted() {
    if (this.hasNotifiedCompleted) {
      logger.debug(
        `[${this.miningId}] notifyCompleted already called; skipping duplicate call.`
      );
      return;
    }
    this.hasNotifiedCompleted = true;
    // Notify signature worker fetching is ended
    await redisClient.xadd(
      this.signatureStream,
      '*',
      'message',
      JSON.stringify({
        type: 'email',
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

    // flush any remaining published emails count
    await publishFetchingProgress(
      this.miningId,
      this.publishedEmails,
      this.isCanceled,
      this.isCompleted
    );

    this.publishedEmails = 0;

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
  async processFolder(folder: PSTFolder) {
    // go through the folders...
    this.totalMessages += folder.emailCount;
    if (folder.hasSubfolders) {
      const childFolders: PSTFolder[] = folder.getSubFolders();
      for (const childFolder of childFolders) {
        await this.processFolder(childFolder);
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

        if (!headers) {
          logger.debug('Skipping this PST email as it lacks header');
          email = folder.getNextChild();
          continue;
        }

        const messageId = getMessageId(headers);
        headers['message-id'] = [messageId];

        const skipThisEmail =
          this.fetchedIds.has(messageId) && !isLastMessageInFolder;

        if (skipThisEmail) {
          logger.debug('Skipping this PST email as it is duplicated');
          email = folder.getNextChild();
          continue;
        }

        const header = await this.publishHeader(
          headers,
          seq,
          isLastMessageInFolder,
          folder.displayName
        );

        if (header && this.fetchEmailBody) {
          await this.publishBody(
            body,
            header,
            seq,
            isLastMessageInFolder,
            folder.displayName,
            email
          );
        }

        this.fetchedIds.add(messageId);
        this.totalFetched += 1;
        this.publishedEmails += 1;

        if (this.publishedEmails >= this.batchSize) {
          await publishFetchingProgress(
            this.miningId,
            this.publishedEmails,
            this.isCanceled,
            this.isCompleted
          );
          this.publishedEmails = 0;
        }

        email = folder.getNextChild();
      }
    }
  }

  async start() {
    logger.info(`Starting PST processing for source: ${this.source}`);

    const start = Date.now();

    // Pre-scan PST to compute total messages before processing
    const total = await this.getTotalMessages();

    // skipcq: JS-0339 non null assertion is safe as pstFile is on class creation
    await this.processFolder(this.pstFile!.getRootFolder());

    const end = Date.now();

    logger.info(`${this.source} processed in ${end - start} ms`);

    this.isCompleted = true;
    await this.stop(this.isCanceled);

    this.removeFile();

    // attempt to delete the uploaded PST from storage after mining
    try {
      const { error: removeErr } = await supabaseClient.storage
        .from(PST_FOLDER)
        .remove([this.source]);

      if (removeErr) {
        logger.warn(
          `[${this.miningId}] Failed to remove PST from storage: ${this.source}`,
          { error: removeErr }
        );
      } else {
        logger.info(
          `[${this.miningId}] Removed PST from storage: ${this.source}`
        );
      }
    } catch (err) {
      logger.warn(`[${this.miningId}] Unexpected error while removing PST`, {
        error: err,
        path: this.source
      });
    }

    return total;
  }

  async downloadPSTFromSupabase(storagePath: string) {
    const { data, error } = await supabaseClient.storage
      .from(PST_FOLDER)
      .download(storagePath);

    if (error) throw error;

    this.localPstFilePath = path.join(
      '/tmp',
      `${Date.now()}-${path.basename(storagePath)}`
    );

    const writeStream = fs.createWriteStream(this.localPstFilePath);
    await pipeline(data.stream(), writeStream);
    this.pstFile = new PSTFile(this.localPstFilePath);
  }

  /**
   * Walk the folder tree recursively and count emails only (no publishing).
   * @param {PSTFolder} folder
   */
  private scanFolderCount(folder: PSTFolder): number {
    let count = folder.emailCount || 0;
    if (folder.hasSubfolders) {
      const childFolders: PSTFolder[] = folder.getSubFolders();
      for (const childFolder of childFolders) {
        count += this.scanFolderCount(childFolder);
      }
    }
    return count;
  }

  /**
   * Performs a pre-scan of the PST file to count all emails across folders.
   * Downloads the PST from supabase, scans it and returns the total.
   */
  async getTotalMessages(): Promise<number> {
    try {
      // skipcq: JS-0339 non null assertion is safe as pstFile is on class creation
      const total = this.scanFolderCount(this.pstFile!.getRootFolder());
      this.totalMessages = total;
      logger.debug(`[${this.miningId}] PST total messages pre-scan: ${total}`);
      return total;
    } catch (err) {
      logger.error('Failed during PST pre-scan for total messages', {
        miningId: this.miningId,
        source: this.source,
        error: err
      });
      this.removeFile();
      throw err;
    }
  }

  removeFile() {
    try {
      if (this.localPstFilePath && fs.existsSync(this.localPstFilePath)) {
        fs.unlinkSync(this.localPstFilePath);
      }
    } catch (e) {
      logger.warn('Could not remove temporary PST file after scan', {
        path: this.localPstFilePath,
        error: e
      });
    }
  }
}
