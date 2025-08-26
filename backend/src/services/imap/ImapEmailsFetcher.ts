import { parseHeader } from 'imap';
import { simpleParser } from 'mailparser';
import { ImapFlow as Connection } from 'imapflow';
// Removed p-limit - using simple batch processing instead
import { EXCLUDED_IMAP_FOLDERS } from '../../utils/constants';
import { getMessageId } from '../../utils/helpers/emailHeaderHelpers';
import hashEmail from '../../utils/helpers/hashHelpers';
import logger from '../../utils/logger';
import redis from '../../utils/redis';
import ImapConnectionProvider from './ImapConnectionProvider';
import { EmailMessage } from './types';
import ENV from '../../config';

const redisClient = redis.getClient();

// Constants
const CONNECTION_TIMEOUT_MS = 10000; // 10 seconds timeout per connection
const EMAIL_TEXT_MAX_LENGTH = 4000; // Maximum length for email text content

interface StreamPipeline {
  stream: string;
  data: EmailMessage;
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
  private readonly userIdentifier: string;

  private readonly processSetKey: string;

  private readonly fetchedIds = new Set<string>();

  private totalFetched = 0;

  public isCompleted = false;

  private isCanceled = false;

  private activeConnections = new Set<Connection>();

  private readonly bodies = ['HEADER'];

  private process?: Promise<void>;

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
      this.bodies.push('');
    }
  }

  /**
   * Acquires an IMAP connection and opens the specified mailbox.
   * @param folderPath - Name of the folder to open
   * @returns Promise resolving to the opened connection and mailbox info
   */
  private async openMailbox(
    folderPath: string
  ): Promise<{ connection: Connection; mailbox: any }> {
    const connection = await this.imapConnectionProvider.acquireConnection();
    logger.debug(
      `[${this.miningId}] Acquired connection for folder ${folderPath}`
    );

    try {
      const mailbox = await connection.mailboxOpen(folderPath, {
        readOnly: true
      });
      logger.debug(`[${this.miningId}] Opened mailbox ${folderPath}`);

      // Track all connections for potential force-closing during cancellation
      this.activeConnections.add(connection);

      return { connection, mailbox };
    } catch (error) {
      // If mailbox opening fails, release the connection immediately
      await this.imapConnectionProvider.releaseConnection(connection);
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
    } catch (err: any) {
      // During cancellation, connections may already be closed - log as debug instead of warning
      if (this.isCanceled && err?.code === 'NoConnection') {
        logger.debug(
          `[${this.miningId}] Mailbox ${folderPath} already closed (expected during cancellation)`
        );
      } else {
        logger.warn(
          `[${this.miningId}] Error closing mailbox ${folderPath}:`,
          err
        );
      }
    } finally {
      // Remove from active connections tracking
      this.activeConnections.delete(connection);

      await this.imapConnectionProvider.releaseConnection(connection);
      logger.debug(
        `[${this.miningId}] Released connection for folder ${folderPath}`
      );
    }
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
      for (const folder of this.folders) {
        if (this.isCanceled) {
          logger.info(
            `[${this.miningId}] Cancellation detected after processing folder ${folder}. No further folders will be processed.`
          );
          break;
        }

        if (EXCLUDED_IMAP_FOLDERS.includes(folder)) {
          // Skip excluded folders
          continue;
        }

        try {
          // Each folder processing method will handle its own connections
          this.process = this.fetchBox(folder);
          // eslint-disable-next-line no-await-in-loop
          await this.process;
        } catch (error) {
          logger.error(
            `[${this.miningId}] Error when fetching emails from folder ${folder}:`,
            error
          );
        }
      }

      this.isCompleted = true;

      // Pubsub to ensure event is received and fetching is closed
      await publishFetchingProgress(this.miningId, 0);

      // Set the fetching status to completed and log message
      logger.info(`[${this.miningId}] All fetch promises are terminated.`);
    } catch (error) {
      logger.error(`[${this.miningId}] Error in fetchEmailMessages:`, error);
      throw error;
    }
  }

  /**
   * Processes fetched messages from a specific range in a folder.
   * @param connection - Open IMAP connection with mailbox already opened
   * @param range - IMAP sequence range to fetch (e.g., '1:1000' or '1:*')
   * @param folderPath - Name of the folder
   * @param totalInFolder - Total number of messages in the folder
   */
  private async processFetch(
    connection: Connection,
    range: string,
    folderPath: string,
    totalInFolder: number
  ) {
    const startTime = Date.now();
    let publishedEmails = 0;
    let processedCount = 0;
    let pipeline = redisClient.multi();

    // Increase batch size for parallel processing
    const parallelBatchSize = Math.max(this.batchSize * 2, 200);

    logger.info(`[${this.miningId}] Starting range ${range}`);

    try {
      for await (const msg of connection.fetch(range, {
        uid: false,
        source: false,
        envelope: true,
        headers: true,
        bodyParts: ['HEADER', 'TEXT']
      })) {
        processedCount += 1;

        const { seq, headers, envelope } = msg;

        let header: Record<string, string[]> | null;
        try {
          header = parseHeader(
            (headers as Buffer<ArrayBufferLike>).toString('utf8')
          );
        } catch (err) {
          logger.warn(
            `[${this.miningId}] Failed to parse header for seq ${seq}, skipping`
          );
          continue;
        }

        let text = '';
        if (msg.bodyParts?.has('text')) {
          const textPart = msg.bodyParts.get('text');
          if (textPart && textPart.length > 0) {
            try {
              const textContent = textPart;
              const { text: parsedText } = await simpleParser(
                Buffer.concat([headers!, textContent]),
                {
                  skipHtmlToText: true,
                  skipTextToHtml: true,
                  skipImageLinks: true,
                  skipTextLinks: true
                }
              );
              text = parsedText?.slice(0, EMAIL_TEXT_MAX_LENGTH) || '';
            } catch (err) {
              text = '';
            }
          }
        }

        const from = envelope?.from?.pop();
        const date = envelope?.date?.toISOString?.();
        const messageId = getMessageId(header);

        header['message-id'] = [messageId];
        const isLastMessageInFolder = msg.seq === totalInFolder;

        // To prevent loss of progress counter, check that the duplicated message is not the final one in the folder.
        if (this.fetchedIds.has(messageId) && !isLastMessageInFolder) {
          continue;
        }

        pipeline.xadd(
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

        if (text && from && date) {
          pipeline.xadd(
            this.signatureStream,
            '*',
            'message',
            JSON.stringify({
              type: 'email',
              data: {
                header: {
                  from,
                  messageId,
                  messageDate: date,
                  rawHeader: header
                },
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

        header = null;

        if (pipeline.length >= parallelBatchSize) {
          await pipeline.exec();
          await publishFetchingProgress(this.miningId, publishedEmails);
          pipeline = redisClient.multi();
          publishedEmails = 0;
        }
      }

      if (pipeline.length) {
        await pipeline.exec();
        await publishFetchingProgress(this.miningId, publishedEmails);
      }

      const totalTime = Date.now() - startTime;
      const rate = processedCount / (totalTime / 1000);
      logger.info(
        `[${this.miningId}] Completed range ${range}: ${processedCount} messages in ${totalTime}ms (${rate.toFixed(1)} msg/sec)`
      );
    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error(
        `[${this.miningId}] Error in range ${range} after ${processedCount} messages in ${totalTime}ms:`,
        error
      );
      throw error;
    }
  }

  /**
   * Acquires connections with timeout handling for parallel processing.
   * @param folderPath - Name of the folder
   * @param numConnections - Number of connections to acquire
   * @returns Array of acquired connections
   */
  private async acquireConnectionsWithTimeout(
    folderPath: string,
    numConnections: number
  ): Promise<Connection[]> {
    const connections: Connection[] = [];

    // Use Promise.allSettled to acquire connections in parallel with individual timeouts
    const connectionPromises = Array.from(
      { length: numConnections },
      async (_unused, i) => {
        const timeoutPromise = new Promise<never>((_unusedResolve, reject) => {
          setTimeout(
            () => reject(new Error('Connection timeout')),
            CONNECTION_TIMEOUT_MS
          );
        });

        const connectionPromise = this.imapConnectionProvider
          .acquireConnection()
          .then(async (conn) => {
            await conn.mailboxOpen(folderPath, { readOnly: true });
            // Track parallel connections as well
            this.activeConnections.add(conn);
            return conn;
          });

        try {
          const conn = await Promise.race([connectionPromise, timeoutPromise]);
          logger.debug(
            `[${this.miningId}] Acquired connection ${i + 1}/${numConnections}`
          );
          return conn;
        } catch (error) {
          const errorMessage = (error as Error).message;
          logger.warn(
            `[${this.miningId}] Failed to acquire connection ${i + 1}: ${errorMessage}`
          );
          throw error;
        }
      }
    );

    const results = await Promise.allSettled(connectionPromises);

    // Collect successful connections
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        connections.push(result.value);
      }
    });

    // If we have some connections but fewer than requested, log the adjustment
    if (connections.length > 0 && connections.length < numConnections) {
      logger.info(
        `[${this.miningId}] Using ${connections.length} available connections instead of ${numConnections}`
      );
    }

    return connections;
  }

  /**
   * Fetches messages from a folder using either single connection or parallel connections based on folder size.
   * @param folderPath - Name of the folder to fetch
   */
  async fetchBox(folderPath: string): Promise<void> {
    const { connection, mailbox } = await this.openMailbox(folderPath);

    try {
      if (mailbox.exists === 0) {
        logger.debug(
          `[${this.miningId}] Folder ${folderPath} is empty, skipping`
        );
        return;
      }

      const totalInFolder = mailbox.exists;

      if (totalInFolder > ENV.FETCHING_CHUNK_SIZE_PER_CONNECTION) {
        await this.processLargeFolder(folderPath, totalInFolder);
      } else {
        logger.debug(
          `[${this.miningId}] Using single connection for ${totalInFolder} messages in ${folderPath}`
        );
        await this.processFetch(connection, '1:*', folderPath, totalInFolder);
      }
    } catch (err) {
      logger.error(
        `[${this.miningId}] Error processing folder ${folderPath}:`,
        err
      );
      throw err;
    } finally {
      await this.closeMailbox(connection, folderPath);
    }
  }

  /**
   * Processes large folders using parallel connections in simple batches.
   * @param folderPath - Name of the folder
   * @param totalInFolder - Total messages in the folder
   */
  private async processLargeFolder(
    folderPath: string,
    totalInFolder: number
  ): Promise<void> {
    logger.info(
      `[${this.miningId}] Parallel fetching ${totalInFolder} messages from ${folderPath}`
    );

    const ranges = buildSequenceRanges(
      totalInFolder,
      ENV.FETCHING_CHUNK_SIZE_PER_CONNECTION
    );

    const numConnections = Math.min(
      ranges.length,
      ENV.FETCHING_MAX_CONNECTIONS_PER_FOLDER
    );

    logger.debug(
      `[${this.miningId}] Requesting ${numConnections} connections for ${ranges.length} ranges`
    );

    const connections = await this.acquireConnectionsWithTimeout(
      folderPath,
      numConnections
    );

    if (connections.length === 0) {
      logger.info(
        `[${this.miningId}] No parallel connections available, using single connection fallback for ${folderPath}`
      );
      const { connection } = await this.openMailbox(folderPath);
      try {
        await this.processFetch(connection, '1:*', folderPath, totalInFolder);
      } finally {
        await this.closeMailbox(connection, folderPath);
      }
      return;
    }

    logger.info(
      `[${this.miningId}] Processing ${ranges.length} ranges with ${connections.length} connections`
    );

    try {
      // Process ranges in batches using available connections
      for (let i = 0; i < ranges.length; i += connections.length) {
        const batch = ranges.slice(i, i + connections.length);
        const batchTasks = batch.map((range, index) => {
          const connection = connections[index];
          return this.processFetch(
            connection,
            range,
            folderPath,
            totalInFolder
          );
        });
        // eslint-disable-next-line no-await-in-loop
        const results = await Promise.allSettled(batchTasks);

        this.handleParallelResults(results, folderPath);
      }
    } finally {
      await this.cleanupConnections(connections);
    }
  }

  /**
   * Handles results from parallel processing.
   * @param results - Results from Promise.allSettled
   * @param folderPath - Name of the folder
   */
  private handleParallelResults(
    results: PromiseSettledResult<void>[],
    folderPath: string
  ): void {
    const failures = results.filter((result) => result.status === 'rejected');
    const successes = results.length - failures.length;

    if (failures.length === results.length) {
      throw new Error(
        `[${this.miningId}] All parallel fetch tasks failed for folder ${folderPath}`
      );
    }

    if (failures.length > 0) {
      logger.warn(
        `[${this.miningId}] ${failures.length} tasks failed, ${successes} completed successfully`
      );
    } else if (successes > 0) {
      logger.info(
        `[${this.miningId}] All ${successes} parallel tasks completed successfully`
      );
    }
  }

  /**
   * Cleans up parallel connections.
   * @param connections - Array of connections to clean up
   */
  private async cleanupConnections(connections: Connection[]): Promise<void> {
    await Promise.allSettled(
      connections.map(async (conn) => {
        try {
          await conn.mailboxClose();
        } catch (err: any) {
          // During cancellation, connections may already be closed
          if (this.isCanceled && err?.code === 'NoConnection') {
            logger.debug(
              `[${this.miningId}] Connection mailbox already closed (expected during cancellation)`
            );
          } else {
            logger.warn(`[${this.miningId}] Error closing mailbox:`, err);
          }
        } finally {
          // Remove from active connections tracking
          this.activeConnections.delete(conn);
          await this.imapConnectionProvider.releaseConnection(conn);
        }
      })
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
        await this.process;
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
