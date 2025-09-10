import { parseHeader } from 'imap';
import { simpleParser } from 'mailparser';
import { ImapFlow as Connection, MailboxObject } from 'imapflow';
import PQueue from 'p-queue';
import { EXCLUDED_IMAP_FOLDERS } from '../../utils/constants';
import { getMessageId } from '../../utils/helpers/emailHeaderHelpers';
import hashEmail from '../../utils/helpers/hashHelpers';
import logger from '../../utils/logger';
import redis from '../../utils/redis';
import ImapConnectionProvider from './ImapConnectionProvider';
import { EmailMessage } from './types';
import ENV from '../../config';

const redisClient = redis.getClient();

interface StreamPipeline {
  stream: string;
  data: EmailMessage;
}

interface EmailJob {
  folder: string;
  range: string;
  totalInFolder: number;
}

interface ProcessedMessage {
  messageId: string;
  header: Record<string, string[]>;
  text: string;
  from: any;
  date: string;
  seq: number;
  folderPath: string;
  isLastMessageInFolder: boolean;
}

/**
 * Publishes an email message to a Redis stream.
 * @param streams - Array contains stream name and the data to publish
 * @returns A promise that resolves when the message is successfully published.
 */
async function publishStreamsPipeline(
  streams: StreamPipeline[]
): Promise<void> {
  const pipeline = redisClient.multi();

  streams.forEach(({ stream, data }) => {
    pipeline.xadd(stream, '*', 'message', JSON.stringify(data));
  });

  await pipeline.exec();
}

/**
 * Publishes the fetching progress for a mining task to redis PubSub.
 * @param miningId - The ID of the mining job.
 * @param fetchedMessagesCount - The number of messages fetched so far.
 */
async function publishFetchingProgress(
  miningId: string,
  fetchedMessagesCount: number
) {
  const progress = {
    miningId,
    count: fetchedMessagesCount,
    progressType: 'fetched'
  };

  // Publish a progress with how many messages we fetched.
  await redisClient.publish(miningId, JSON.stringify(progress));
}

/**
 * Builds sequence ranges for IMAP fetching based on total messages.
 * @param total - Total number of messages
 * @param chunkSize - Size of each chunk (default: 10000)
 * @returns Array of IMAP sequence range strings
 */
function buildSequenceRanges(total: number, chunkSize: number): string[] {
  const ranges: string[] = [];
  let start = 1;

  while (start <= total) {
    const end = Math.min(start + chunkSize - 1, total);
    ranges.push(`${start}:${end}`);
    start = end + 1;
  }

  return ranges;
}

export default class ImapEmailsFetcher {
  private readonly EMAIL_TEXT_MAX_LENGTH = 3000;

  private readonly userIdentifier: string;

  private readonly processSetKey: string;

  private readonly fetchedIds = new Set<string>();

  private totalFetched = 0;

  public isCompleted = false;

  private isCanceled = false;

  private hasAuthFailureLogged = false;

  private activeConnections = new Set<Connection>();

  private readonly bodies = ['HEADER'];

  private readonly EMAIL_JOBS = new PQueue({
    concurrency: ENV.FETCHING_MAX_CONNECTIONS_PER_FOLDER
  });

  /**
   * Constructor for ImapEmailsFetcher.
   * @param imapConnectionProvider - An instance of a configured IMAP connection provider.
   * @param folders - List of folders to fetch.
   * @param userId - The unique identifier of the user.
   * @param userEmail - The email address of the user.
   * @param miningId - The unique identifier of the mining process.
   * @param streamName - The name of the stream to write fetched emails.
   * @param fetchEmailBody - Whether to fetch email body or not.
   * @param batchSize - A Number To send notification every x emails processed
   */
  constructor(
    private readonly imapConnectionProvider: ImapConnectionProvider,
    public readonly folders: string[],
    private readonly userId: string,
    private readonly userEmail: string,
    private readonly miningId: string,
    private readonly contactStream: string,
    private readonly signatureStream: string,
    private readonly fetchEmailBody = false,
    private readonly batchSize = 50
  ) {
    // Generate a unique identifier for the user.
    this.userIdentifier = hashEmail(userEmail, userId);
    // Set the key for the process set. used for caching.
    this.processSetKey = `caching:${miningId}`;

    if (this.fetchEmailBody) {
      this.bodies.push('TEXT');
    }
  }

  /**
   * Acquires an IMAP connection and opens the specified mailbox.
   * @param folderPath - Name of the folder to open
   * @returns Promise resolving to the opened connection and mailbox info
   */
  private async openMailbox(
    folderPath: string
  ): Promise<{ connection: Connection; mailbox: MailboxObject }> {
    const startTime = Date.now();

    try {
      const connection = await this.imapConnectionProvider.acquireConnection();
      const acquireTime = Date.now() - startTime;

      if (acquireTime > 5000) {
        // Log slow connection acquisition
        logger.warn(
          `[${this.miningId}] Slow connection acquisition: ${acquireTime}ms for ${folderPath}`
        );
      }

      logger.debug(
        `[${this.miningId}] Acquired connection for folder ${folderPath} (${acquireTime}ms, active: ${this.activeConnections.size})`
      );

      try {
        const mailbox = await connection.mailboxOpen(folderPath, {
          readOnly: true
        });
        logger.debug(`[${this.miningId}] Opened mailbox ${folderPath}`);

        this.activeConnections.add(connection);

        return { connection, mailbox };
      } catch (error) {
        await this.imapConnectionProvider.releaseConnection(connection);
        throw error;
      }
    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error(
        `[${this.miningId}] Failed to acquire/open connection for ${folderPath} after ${totalTime}ms:`,
        error
      );
      throw error;
    }
  }

  /**
   * Closes the mailbox and releases the IMAP connection.
   * @param connection - The IMAP connection to close
   * @param folderPath - Name of the folder (for logging)
   */
  private async closeMailbox(
    connection: Connection,
    folderPath: string
  ): Promise<void> {
    try {
      await connection.mailboxClose();
      logger.debug(`[${this.miningId}] Closed mailbox ${folderPath}`);
    } catch (err) {
      logger.warn(
        `[${this.miningId}] Error closing mailbox ${folderPath}:`,
        err
      );
    } finally {
      this.activeConnections.delete(connection);
      await this.imapConnectionProvider.releaseConnection(connection);
      logger.debug(
        `[${this.miningId}] Released connection for folder ${folderPath}`
      );
    }
  }

  /**
   * Checks if an error represents a fatal authentication failure.
   * @param error - The error to check
   * @returns True if this is an authentication failure
   */
  private static isAuthFailure(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const err = error as Record<string, unknown>;

    return (
      err.authenticationFailed === true ||
      err.serverResponseCode === 'AUTHENTICATIONFAILED' ||
      (err.responseStatus === 'NO' &&
        typeof err.responseText === 'string' &&
        err.responseText.includes('Invalid credentials')) ||
      (typeof err.message === 'string' &&
        (err.message.includes('AUTHENTICATIONFAILED') ||
          err.message.includes('Invalid credentials')))
    );
  }

  /**
   * Fetches the total number of messages across the specified folders on an IMAP server.
   */
  async getTotalMessages() {
    let imapConnection: Connection | null = null;
    let total = 0;

    try {
      imapConnection = await this.imapConnectionProvider.acquireConnection();

      // Create an array of Promises that resolve to the total number of messages in each folder.
      const folders = this.folders.filter(
        (folder) => !EXCLUDED_IMAP_FOLDERS.includes(folder)
      );

      logger.debug(
        `[${this.constructor.name}:getTotalMessages] fetching total messages`,
        {
          miningId: this.miningId,
          email: this.userEmail,
          folders: this.folders
        }
      );

      const totalPromises = folders.map(async (folder) => {
        try {
          const status = await imapConnection?.status(folder, {
            messages: true
          });
          return status?.messages ?? 0;
        } catch (err) {
          logger.warn(`Could not STATUS ${folder}`, err);
          return 0;
        }
      });

      // Calculate the total number of messages across all folders.
      const totalArray = await Promise.all(totalPromises).catch((error) => {
        throw error;
      });

      for (const val of totalArray) {
        total += val;
      }
    } catch (err) {
      logger.error('Failed fetching total messages', {
        miningId: this.miningId,
        email: this.userEmail,
        folders: this.folders,
        error: err
      });
      throw err;
    } finally {
      if (imapConnection) {
        await this.imapConnectionProvider.releaseConnection(imapConnection);
      }
    }
    return total;
  }

  /**
   * Fetches all email messages in the configured boxes.
   */
  async fetchEmailMessages() {
    try {
      const emailJobs = (
        await Promise.all(
          this.folders
            .filter((folder) => !EXCLUDED_IMAP_FOLDERS.includes(folder))
            .map((folder) => this.buildEmailJobsForFolder(folder))
        )
      ).flat();

      if (emailJobs.length === 0) {
        logger.info(`[${this.miningId}] No email jobs to process`);
        return;
      }

      logger.info(
        `[${this.miningId}] Processing ${emailJobs.length} email jobs across ${this.folders.length} folders`
      );

      emailJobs.map((emailJob) =>
        this.EMAIL_JOBS.add(() => this.processEmailJob(emailJob))
      );

      await this.EMAIL_JOBS.onIdle();

      logger.info(`[${this.miningId}] All email jobs processed`);
    } catch (error) {
      logger.error(`[${this.miningId}] Error in fetchEmailMessages:`, error);
      throw error;
    } finally {
      this.isCompleted = true;
      await publishFetchingProgress(this.miningId, 0);
      logger.info(
        `[${this.miningId}] All fetch operations completed successfully`
      );
    }
  }

  /**
   * Builds email jobs for a single folder.
   */
  private async buildEmailJobsForFolder(folder: string): Promise<EmailJob[]> {
    const messageCount = await this.getFolderMessageCount(folder);

    if (messageCount === 0) {
      logger.debug(`[${this.miningId}] Folder ${folder} is empty, skipping`);
      return [];
    }

    const emailJobs =
      messageCount <= ENV.FETCHING_CHUNK_SIZE_PER_CONNECTION
        ? [
            {
              folder,
              range: '1:*',
              totalInFolder: messageCount
            }
          ]
        : buildSequenceRanges(
            messageCount,
            ENV.FETCHING_CHUNK_SIZE_PER_CONNECTION
          ).map((range) => ({
            folder,
            range,
            totalInFolder: messageCount
          }));

    logger.debug(
      `[${this.miningId}] Created ${emailJobs.length} email jobs for folder ${folder} (${messageCount} messages)`
    );

    return emailJobs;
  }

  /**
   * Gets the message count for a specific folder.
   */
  private async getFolderMessageCount(folder: string): Promise<number> {
    const { connection, mailbox } = await this.openMailbox(folder);
    try {
      return mailbox.exists;
    } finally {
      await this.closeMailbox(connection, folder);
    }
  }

  /**
   * Opens a connection and fetches messages.
   * @param emailJob - The email job to process
   */
  private async processEmailJob(emailJob: EmailJob): Promise<void> {
    if (this.isCanceled) {
      return;
    }

    const { connection } = await this.openMailbox(emailJob.folder);
    try {
      await this.fetchMessagesFromRange(
        connection,
        emailJob.range,
        emailJob.folder,
        emailJob.totalInFolder
      );
    } catch (error) {
      if (ImapEmailsFetcher.isAuthFailure(error)) {
        if (!this.hasAuthFailureLogged) {
          logger.error(`[${this.miningId}] Authentication failed`, error);
          this.hasAuthFailureLogged = true;
        }
        this.isCanceled = true;
      } else {
        logger.error(
          `[${this.miningId}] Error processing ${emailJob.folder}:${emailJob.range}:`,
          error
        );
      }
      throw error;
    } finally {
      await this.closeMailbox(connection, emailJob.folder);
    }
  }

  /**
   * Processes fetched messages from a specific range in a folder.
   */
  private async fetchMessagesFromRange(
    connection: Connection,
    range: string,
    folderPath: string,
    totalInFolder: number
  ): Promise<void> {
    const startTime = Date.now();
    let publishedEmails = 0;
    let processedCount = 0;
    let pipeline = redisClient.multi();
    const batchSize = Math.max(this.batchSize, 100);

    logger.info(`[${this.miningId}] Starting range ${range} in ${folderPath}`);

    try {
      for await (const msg of this.createFetchStream(connection, range)) {
        if (this.isCanceled) {
          logger.info(
            `[${this.miningId}] Cancellation detected; stopping range ${range}`
          );
          break;
        }

        processedCount += 1;
        const processedMessage = await this.processMessage(
          msg,
          folderPath,
          totalInFolder
        );

        if (!processedMessage) continue; // Skip duplicates or failed parsing

        // Add to pipeline
        this.addMessageToPipeline(pipeline, processedMessage);

        publishedEmails += 1;
        this.fetchedIds.add(processedMessage.messageId);
        this.totalFetched += 1;

        // Execute batch if needed
        if (pipeline.length >= batchSize) {
          await this.executePipelineBatch(pipeline, publishedEmails);

          pipeline = redisClient.multi();
          publishedEmails = 0;
        }
      }

      // Execute remaining messages
      if (pipeline.length > 0) {
        await this.executePipelineBatch(pipeline, publishedEmails);
      }

      this.logRangeCompletion(range, processedCount, startTime);
    } catch (error) {
      this.logRangeError(range, processedCount, startTime, error);
      throw error;
    }
  }

  /**
   * Creates a fetch stream for IMAP messages.
   */
  private createFetchStream(connection: Connection, range: string) {
    return connection.fetch(range, {
      uid: false,
      source: false,
      envelope: true,
      headers: true,
      bodyParts: this.bodies
    });
  }

  /**
   * Processes a single message and returns parsed data.
   */
  private async processMessage(
    msg: any,
    folderPath: string,
    totalInFolder: number
  ): Promise<ProcessedMessage | null> {
    const { seq, headers, envelope } = msg;

    // Parse headers
    let header: Record<string, string[]>;
    try {
      header = parseHeader((headers as Buffer).toString('utf8'));
    } catch (err) {
      logger.warn(
        `[${this.miningId}] Failed to parse header for seq ${seq}, skipping`
      );
      return null;
    }

    // Extract message info
    const messageId = getMessageId(header);
    const from = envelope?.from?.pop();
    const date = envelope?.date?.toISOString?.();
    const isLastMessageInFolder = seq === totalInFolder;

    // Skip duplicates (except last message)
    if (this.fetchedIds.has(messageId) && !isLastMessageInFolder) {
      return null;
    }

    // Parse email body if needed
    const text = await this.parseEmailBodyText(msg, headers);

    header['message-id'] = [messageId];

    return {
      messageId,
      header,
      text,
      from,
      date,
      seq,
      folderPath,
      isLastMessageInFolder
    };
  }

  /**
   * Extracts email text content.
   */
  private async parseEmailBodyText(msg: any, headers: Buffer): Promise<string> {
    if (!msg.bodyParts?.has('text')) return '';

    const textPart = msg.bodyParts.get('text');
    if (!headers || !textPart || textPart.length === 0) return '';

    try {
      const { text } = await simpleParser(Buffer.concat([headers, textPart]), {
        skipHtmlToText: true,
        skipTextToHtml: true,
        skipImageLinks: true,
        skipTextLinks: true
      });
      return text?.slice(0, this.EMAIL_TEXT_MAX_LENGTH) || '';
    } catch (err) {
      return '';
    }
  }

  /**
   * Adds processed message to Redis pipeline.
   */
  private addMessageToPipeline(pipeline: any, message: ProcessedMessage): void {
    // Add to contact stream
    pipeline.xadd(
      this.contactStream,
      '*',
      'message',
      JSON.stringify({
        type: 'email',
        data: {
          header: message.header,
          body: '',
          seqNumber: message.seq,
          folderPath: message.folderPath,
          isLast: message.isLastMessageInFolder
        },
        userId: this.userId,
        userEmail: this.userEmail,
        userIdentifier: this.userIdentifier,
        miningId: this.miningId
      })
    );

    // Add to signature stream if has text content
    if (message.text && message.from && message.date) {
      pipeline.xadd(
        this.signatureStream,
        '*',
        'message',
        JSON.stringify({
          type: 'email',
          data: {
            header: {
              from: message.from,
              messageId: message.messageId,
              messageDate: message.date,
              rawHeader: message.header
            },
            body: message.text,
            seqNumber: message.seq,
            folderPath: message.folderPath,
            isLast: false
          },
          userId: this.userId,
          userEmail: this.userEmail,
          userIdentifier: this.userIdentifier,
          miningId: this.miningId
        })
      );
    }
  }

  /**
   * Executes pipeline batch and publishes progress.
   */
  private async executePipelineBatch(
    pipeline: any,
    count: number
  ): Promise<void> {
    await pipeline.exec();
    await publishFetchingProgress(this.miningId, count);
  }

  /**
   * Logs range completion.
   */
  private logRangeCompletion(
    range: string,
    processedCount: number,
    startTime: number
  ): void {
    const totalTime = Date.now() - startTime;
    const rate = processedCount / (totalTime / 1000);
    logger.info(
      `[${this.miningId}] Completed range ${range}: ${processedCount} messages in ${totalTime}ms (${rate.toFixed(1)} msg/sec)`
    );
  }

  /**
   * Logs range error.
   */
  private logRangeError(
    range: string,
    processedCount: number,
    startTime: number,
    error: any
  ): void {
    const totalTime = Date.now() - startTime;
    logger.error(
      `[${this.miningId}] Error in range ${range} after ${processedCount} messages in ${totalTime}ms:`,
      error
    );
  }

  /**
   * Starts fetching email messages.
   */
  start() {
    return this.fetchEmailMessages();
  }

  /**
   * Performs cleanup operations after the fetching process has finished or stopped.
   */
  async stop(cancel: boolean) {
    try {
      if (cancel) {
        logger.info(`[${this.miningId}] Canceling fetching process...`);
        this.isCanceled = true;
      }

      try {
        // Force close all active connections to interrupt ongoing fetch operations
        if (this.activeConnections.size > 0) {
          logger.info(
            `[${this.miningId}] Force closing ${this.activeConnections.size} active connections`
          );
          const closePromises = Array.from(this.activeConnections).map(
            (connection) => connection.close()
          );
          await Promise.allSettled(closePromises);
        }

        // Gracefully shutdown email jobs queue
        if (this.EMAIL_JOBS.size > 0 || this.EMAIL_JOBS.pending > 0) {
          logger.info(
            `[${this.miningId}] Stopping EMAIL_JOBS queue: ${this.EMAIL_JOBS.size} queued, ${this.EMAIL_JOBS.pending} pending`
          );

          if (cancel) {
            // Clear pending tasks on cancellation
            this.EMAIL_JOBS.clear();
          } else {
            // Wait for current tasks to complete gracefully
            await this.EMAIL_JOBS.onIdle();
          }
        }
      } catch (e) {
        logger.debug(
          `[${this.miningId}] Process completed with error:`,
          (e as Error)?.message || e
        );
      }

      logger.info(
        `[${this.miningId}] Publishing final signature stream message...`
      );
      // Notify signature worker fetching is ended
      await publishStreamsPipeline([
        {
          stream: this.signatureStream,
          data: {
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
          }
        }
      ]);

      logger.info(
        `[${this.miningId}] Fetching process ${cancel ? 'canceled' : 'stopped'} successfully`
      );

      // Cleanup operations
      await redisClient.unlink(this.processSetKey);
      await this.imapConnectionProvider.cleanPool(); // Do it async because it may take up to 30s to close

      return this.isCompleted;
    } catch (error) {
      logger.error(`[${this.miningId}] Error during stop process:`, error);
      throw error;
    }
  }
}
