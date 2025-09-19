import { parseHeader } from 'imap';
import { ImapFlow as Connection } from 'imapflow';
import { simpleParser } from 'mailparser';
import PQueue from 'p-queue';
import util from 'util';
import ENV from '../../config';
import { EXCLUDED_IMAP_FOLDERS } from '../../utils/constants';
import { getMessageId } from '../../utils/helpers/emailHeaderHelpers';
import hashEmail from '../../utils/helpers/hashHelpers';
import logger from '../../utils/logger';
import redis from '../../utils/redis';
import ImapConnectionProvider from './ImapConnectionProvider';
const redisClient = redis.getClient();

interface EmailJob {
  folder: string;
  range: string;
  totalInFolder: number;
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
function buildSequenceRanges(total: number, chunkSize = 10000): string[] {
  const ranges: string[] = [];

  if (total <= chunkSize) {
    return ['1:*'];
  }

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

  private isCanceled: boolean;

  private totalFetched: number;

  private hasOAuthError = false;

  private readonly bodies: string[];

  private readonly emailsQueue: PQueue;

  private readonly processSetKey: string;

  private readonly userIdentifier: string;

  private readonly fetchedIds: Set<string>;

  public isCompleted: boolean;

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

    this.totalFetched = 0;

    this.isCanceled = false;
    this.isCompleted = false;

    this.fetchedIds = new Set<string>();
    this.emailsQueue = new PQueue({
      concurrency: ENV.FETCHING_MAX_CONNECTIONS_PER_FOLDER,
      intervalCap: 1, // only 1 job starts per interval
      interval: 100 // 100ms gap between job starts
    });
    this.bodies = this.fetchEmailBody ? ['TEXT'] : []; // HEADER is handled by ImapFlow;
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

  async getAvailableConnections(): Promise<number> {
    const clients: Connection[] = [];
    const attempts = Array.from(
      { length: ENV.FETCHING_MAX_CONNECTIONS_PER_FOLDER },
      (_, i) => i
    );

    const results = await Promise.allSettled(
      attempts.map(async () => {
        const conn = await this.imapConnectionProvider.acquireConnection();
        clients.push(conn);
        return true;
      })
    );

    // Count how many succeeded
    const count = results.filter((r) => r.status === 'fulfilled').length;

    // Cleanup
    await Promise.all(
      clients.map((c) =>
        this.imapConnectionProvider.releaseConnection(c).catch(() => {})
      )
    );

    logger.info(`Server approved ${count} connections`);
    return count;
  }

  /**
   * Fetches all email messages in the configured boxes.
   */
  async fetchEmailMessages() {
    const emailJobs: EmailJob[] = [];

    // Adapt queue to use the available connections.
    this.emailsQueue.concurrency = await this.getAvailableConnections();

    const foldersToProcess = this.folders.filter(
      (f) => !EXCLUDED_IMAP_FOLDERS.includes(f)
    );

    // Map folders to async jobs
    await Promise.all(
      foldersToProcess.map(async (folder) => {
        const connection =
          await this.imapConnectionProvider.acquireConnection();
        try {
          const mailbox = await connection.mailboxOpen(folder, {
            readOnly: true
          });
          const totalInFolder = mailbox.exists;

          await connection.mailboxClose();

          if (totalInFolder === 0) return;

          const ranges = buildSequenceRanges(
            totalInFolder,
            ENV.FETCHING_CHUNK_SIZE_PER_CONNECTION
          );

          logger.debug(
            `Preparing ${ranges.length} ranges for total folder emails ${totalInFolder} to pushed to queue`
          );
          ranges.forEach((range) => {
            emailJobs.push({
              folder,
              range,
              totalInFolder
            });
          });
        } catch (err) {
          logger.warn(
            `Failed to process folder ${folder}: ${(err as Error).message}`
          );
        } finally {
          if (connection) {
            await this.imapConnectionProvider.releaseConnection(connection);
          }
        }
      })
    );
    try {
      emailJobs.forEach((job) =>
        this.emailsQueue.add(() => this.processEmailJob(job))
      );
      await this.emailsQueue.onIdle();
      this.isCompleted = true;

      await publishFetchingProgress(this.miningId, 0);
      logger.info(`[${this.miningId}] All email jobs completed`);
    } catch (err) {
      logger.error(err);
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
   * Process fetch for a range
   */
  private async processFetch(
    connection: Connection,
    range: string,
    folderPath: string,
    totalInFolder: number
  ) {
    let publishedEmails = 0;
    const batchSize = Math.max(this.batchSize, 200);

    for await (const msg of this.createFetchStream(connection, range)) {
      if (this.isCanceled) break;

      let header: Record<string, string[]>;
      const { seq, headers, envelope } = msg;
      const from = envelope?.from?.pop();
      const date = envelope?.date?.toISOString?.();

      if (from?.address === this.userEmail) continue;

      try {
        header = parseHeader((headers as Buffer).toString('utf8'));
      } catch {
        continue;
      }

      const messageId = getMessageId(header);
      header['message-id'] = [messageId];

      const isLastMessageInFolder = msg.seq === totalInFolder;

      if (this.fetchedIds.has(messageId) && !isLastMessageInFolder) continue;

      await redisClient.xadd(
        this.contactStream,
        '*',
        'message',
        JSON.stringify({
          type: 'email',
          data: {
            header,
            body: '',
            seqNumber: seq,
            folderPath,
            isLast: isLastMessageInFolder
          },
          userId: this.userId,
          userEmail: this.userEmail,
          userIdentifier: this.userIdentifier,
          miningId: this.miningId
        })
      );

      let text = msg.bodyParts?.get('text') ?? '';

      if (headers && text?.length) {
        try {
          const { text: parsedText } = await simpleParser(
            Buffer.concat([headers, text as Uint8Array<ArrayBufferLike>]),
            {
              skipHtmlToText: true,
              skipTextToHtml: true,
              skipImageLinks: true,
              skipTextLinks: true
            }
          );
          text = parsedText?.slice(0, this.EMAIL_TEXT_MAX_LENGTH) || '';
        } catch {
          text = '';
        }
      }

      if (text.length && from && date) {
        await redisClient.xadd(
          this.signatureStream,
          '*',
          'message',
          JSON.stringify({
            type: 'email',
            data: {
              header: { from, messageId, messageDate: date, rawHeader: header },
              body: text,
              seqNumber: seq,
              folderPath,
              isLast: false
            },
            userId: this.userId,
            userEmail: this.userEmail,
            userIdentifier: this.userIdentifier,
            miningId: this.miningId
          })
        );
      }

      this.fetchedIds.add(messageId);
      this.totalFetched += 1;
      publishedEmails += 1;

      if (publishedEmails >= batchSize) {
        await publishFetchingProgress(this.miningId, publishedEmails);
        publishedEmails = 0;
      }
    }

    if (publishedEmails > 0) {
      await publishFetchingProgress(this.miningId, publishedEmails);
      publishedEmails = 0;
    }
  }

  /**
   * Opens a connection and fetches messages.
   * @param emailJob - The email job to process
   */
  private async processEmailJob(emailJob: EmailJob): Promise<void> {
    if (this.isCanceled) return;

    const { folder, range, totalInFolder } = emailJob;

    let connection: Connection | null = null;
    try {
      connection = await this.imapConnectionProvider.acquireConnection();
      await connection.mailboxOpen(folder, { readOnly: true });
      logger.info(
        `[${this.miningId}:${folder}]: Opened folder for range ${range}`
      );

      await this.processFetch(connection, range, folder, totalInFolder);

      await connection.mailboxClose();
      logger.info(
        `[${this.miningId}:${folder}]: Closed folder for range ${range}`
      );

      await this.imapConnectionProvider.releaseConnection(connection);
    } catch (error) {
      logger.error(
        `[${this.miningId}:${folder}]:`,
        util.inspect(error, { depth: null, colors: true })
      );

      if (ImapEmailsFetcher.isAuthFailure(error)) {
        logger.warn(`Is Auth Error`);

        this.emailsQueue.add(() =>
          this.processEmailJob({ range, folder, totalInFolder })
        );
        logger.debug('emailsQueue: Added');

        if (this.hasOAuthError) return;
        this.hasOAuthError = true; // to avoid refreshing pool on every connection
        logger.warn(`Is Auth Error, Refreshing OAuth token at ${range}`);

        this.emailsQueue.pause();
        logger.debug('emailsQueue: Paused');

        await this.imapConnectionProvider.refreshPool();
        logger.debug('Refreshed Pool');

        this.emailsQueue.start();
        logger.debug('emailsQueue: Started');
        return;
      } else if (connection) {
        await this.imapConnectionProvider.releaseConnection(connection);
      }
      this.isCanceled = true;
      throw error;
    }
  }

  /**
   * Starts fetching email messages.
   */
  start() {
    return this.fetchEmailMessages();
  }

  /**
   * Performs cleanupConnections operations after the fetching process has finished or stopped.
   */
  async stop(cancel: boolean) {
    try {
      if (cancel) {
        logger.info(`[${this.miningId}] Canceling fetching process...`);
        this.isCanceled = true;
      }

      logger.info(
        `[${this.miningId}] Publishing final signature stream message...`
      );

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
        `[${this.miningId}] Fetching process ${cancel ? 'canceled' : 'stopped'} successfully`
      );
      return this.isCompleted;
    } catch (error) {
      logger.error(
        `[${this.miningId}] Error during stop process:`,
        util.inspect(error, { depth: null, colors: true })
      );
      throw error;
    } finally {
      // Cleanup operations
      this.emailsQueue.clear();
      await redisClient.unlink(this.processSetKey);
      await this.imapConnectionProvider.cleanPool(); // Do it async because it may take up to 30s to close
    }
  }
}
