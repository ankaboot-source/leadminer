import { parseHeader } from 'imap';
import { ImapFlow as Connection, MessageStructureObject } from 'imapflow';
import PQueue from 'p-queue';
import { decodeQuotedPrintable } from 'lettercoder';
import iconv from 'iconv-lite';
import Encoding from 'encoding-japanese';
import { EXCLUDED_IMAP_FOLDERS } from '../../utils/constants';
import hashEmail from '../../utils/helpers/hashHelpers';
import logger from '../../utils/logger';
import ImapConnectionProvider from './ImapConnectionProvider';
import ENV from '../../config';
import redis from '../../utils/redis';
import { getMessageId } from '../../utils/helpers/emailHeaderHelpers';

const redisClient = redis.getClient();

interface EmailJob {
  folder: string;
  range: string;
  isUid: boolean;
  partId?: string;
  totalInFolder: number;
}

/**
 * Recursively find the first text/plain part ID in an IMAP BODYSTRUCTURE.
 * @param node - The BODYSTRUCTURE object returned by ImapFlow
 * @returns The part ID string (e.g., "1.2") or null if not found
 */
function findPlainTextNode(
  node?: MessageStructureObject
): MessageStructureObject | null {
  if (!node) return null;

  const type = (node.type || '').toLowerCase();

  if (type === 'text/plain') {
    return node || null;
  }

  if (Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) {
      const result = findPlainTextNode(child);
      if (result) return result;
    }
  }

  return null;
}

function decodeTextPart(
  buffer: Buffer<ArrayBufferLike>,
  charset = 'utf-8',
  transferEncoding = '7bit'
): string {
  const encoding = transferEncoding?.toLowerCase() ?? '7bit';
  const charsetNorm = (charset || 'ascii').toString().trim().toLowerCase();

  let bytes = buffer;
  switch (encoding) {
    case 'base64':
      bytes = Buffer.from(
        buffer.toString('ascii').trim().replace(/\s+/g, ''),
        'base64'
      );
      break;

    case 'quoted-printable':
      bytes = Buffer.from(decodeQuotedPrintable(buffer.toString('latin1')));
      break;

    default:
      break;
  }

  let text: string;
  try {
    if (/^jis|^iso-?2022-?jp|^eucjp/i.test(charsetNorm)) {
      text = Encoding.convert(bytes, {
        from: charsetNorm.toUpperCase() as Encoding.Encoding,
        to: 'UNICODE',
        type: 'string'
      });
    } else {
      text = iconv.decode(bytes, charsetNorm);
    }
  } catch {
    text = bytes.toString('utf-8');
  }
  return text;
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
  public isCanceled: boolean;

  public isCompleted: boolean;

  private totalFetched: number;

  private isRefreshingOAuthToken = false;

  private FETCHING_MAX_ERRORS: number;

  private FETCHING_TOTAL_ERRORS: number;

  private readonly EMAIL_TEXT_MAX_LENGTH: number;

  private readonly bodies: string[];

  private readonly emailsQueue: PQueue;

  private readonly processSetKey: string;

  private readonly userIdentifier: string;

  private readonly fetchedIds: Set<string>;

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
    private readonly fetchEmailBody: boolean,
    private readonly batchSize: number,
    private readonly maxBodyTextSize: number | undefined,
    private readonly maxConcurrentConnections = ENV.FETCHING_MAX_CONNECTIONS_PER_FOLDER
  ) {
    // Generate a unique identifier for the user.
    this.userIdentifier = hashEmail(userEmail, userId);
    // Set the key for the process set. used for caching.
    this.processSetKey = `caching:${miningId}`;

    // Fetching state
    this.totalFetched = 0;
    this.isCanceled = false;
    this.isCompleted = false;

    // Email body length to send
    this.EMAIL_TEXT_MAX_LENGTH = 3000;

    // Error Tracking
    this.FETCHING_TOTAL_ERRORS = 0;
    this.FETCHING_MAX_ERRORS = maxConcurrentConnections * 1.5;

    this.fetchedIds = new Set<string>();
    this.emailsQueue = new PQueue({
      concurrency: this.maxConcurrentConnections,
      intervalCap: 1, // only 1 job starts per interval
      interval: 300 // 200ms gap between each job starts
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

    // 1. Check for IMAP authentication failures (your existing logic)
    const isImapAuthError =
      err.authenticationFailed === true ||
      err.serverResponseCode === 'AUTHENTICATIONFAILED' ||
      (typeof err.responseText === 'string' &&
        err.responseText.includes('Invalid credentials')) ||
      (typeof err.message === 'string' &&
        (err.message.includes('AUTHENTICATIONFAILED') ||
          err.message.includes('Invalid credentials')));

    // 2. Check for OAuth/JWT token expiration
    const isTokenExpired =
      (typeof err.message === 'string' &&
        (err.message.includes('token is expired') ||
          err.message.includes('JWT expired') ||
          err.message.includes('invalid JWT') ||
          err.message.includes('bad_jwt'))) ||
      err.code === 'bad_jwt' ||
      err.name === 'AuthApiError';

    return isImapAuthError || isTokenExpired;
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
    const emailJobs: EmailJob[] = [];

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
              totalInFolder,
              isUid: false
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

      if (!this.isCanceled) {
        await this.stop(false);
      }

      logger.info(`[${this.miningId}] All email jobs completed`);
    } catch (err) {
      logger.error(err);
    }
  }

  /**
   * Fetches all email messages in the configured boxes.
   */
  async fetchEmailMessagesWithBody() {
    const emailJobs: {
      range: string;
      folder: string;
      totalInFolder: number;
    }[] = [];

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
      /* eslint-disable no-await-in-loop */
      for (const job of emailJobs) {
        let connection: Connection | null = null;
        this.emailsQueue.add(async () => {
          if (this.isCanceled) return;
          try {
            connection = await this.imapConnectionProvider.acquireConnection();

            const textPlainMap = new Map<string, Set<number>>();

            const { range, folder, totalInFolder } = job;

            logger.debug(
              `[${this.miningId}:${folder}:${range}] Starting bodyStructure fetch for ${totalInFolder} emails`
            );

            await connection.mailboxOpen(folder, { readOnly: true });

            const stream = await connection.fetchAll(range, {
              bodyStructure: true,
              uid: true,
              source: false,
              headers: false
            });

            for (const { uid, bodyStructure } of stream) {
              const node = findPlainTextNode(bodyStructure);
              const size = node?.size ?? 0;

              let key = node?.part ? node.part : '__no_text__';

              if (this.maxBodyTextSize && size > this.maxBodyTextSize)
                key = '__no_text__';

              if (!textPlainMap.has(key)) textPlainMap.set(key, new Set());
              textPlainMap.get(key)?.add(uid);
            }

            this.emailsQueue.addAll(
              Array.from(textPlainMap.entries()).map(([partId, uids]) => {
                const uidList = Array.from(uids);
                logger.debug(
                  `[${this.miningId}:${folder}:${range}] Queuing ${uidList.length} UIDs for partId=${partId}`
                );
                return async () => {
                  await this.processEmailJob({
                    folder,
                    partId: partId === '__no_text__' ? undefined : partId,
                    totalInFolder,
                    range: uidList.join(','),
                    isUid: partId !== '__no_text__'
                  });
                };
              }),
              { priority: 1 }
            );

            await connection.mailboxClose();
          } catch (err) {
            logger.error(
              `Error during bodyStructure fetch: ${(err as Error).message}`,
              { error: err }
            );
          } finally {
            if (connection?.usable)
              await this.imapConnectionProvider.releaseConnection(connection);
            else if (connection)
              await this.imapConnectionProvider.destroyConnection(connection);
          }
        });
      }
      /* eslint-enable no-await-in-loop */

      await this.emailsQueue.onIdle();

      this.isCompleted = true;

      if (!this.isCanceled) {
        await this.stop(false);
      }

      logger.info(`[${this.miningId}] All email jobs completed`);
    } catch (err) {
      logger.error(err);
    }
  }

  /**
   * Process fetch for a range
   */
  private async processFetch(
    connection: Connection,
    range: string,
    isUid: boolean,
    partId: string | undefined,
    folderPath: string,
    totalInFolder: number
  ) {
    let publishedEmails = 0;
    const batchSize = Math.max(this.batchSize, 200);

    const streamGen = connection.fetch(
      range,
      {
        source: false,
        envelope: true,
        headers: true,
        bodyStructure: true,
        bodyParts: partId ? [partId] : undefined
      },
      {
        uid: isUid
      }
    );

    for await (const msg of streamGen) {
      if (this.isCanceled) {
        logger.debug(
          `[${this.miningId}:${folderPath}]: Received cancellation signal, aborting... `
        );
        connection.close();

        throw new Error('Received cancellation signal, Aborting');
      }

      let header: Record<string, string[]>;
      const { seq, headers, envelope } = msg;
      const from = envelope?.from?.pop();
      const date = envelope?.date?.toISOString?.();

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

      this.fetchedIds.add(messageId);
      this.totalFetched += 1;
      publishedEmails += 1;

      if (publishedEmails >= batchSize) {
        await publishFetchingProgress(
          this.miningId,
          publishedEmails,
          this.isCanceled,
          this.isCompleted
        );
        publishedEmails = 0;
      }

      if (!this.fetchEmailBody || !partId || from?.address === this.userEmail)
        continue;

      const textBuffer = msg.bodyParts?.get(partId);
      const partInfo = findPlainTextNode(msg.bodyStructure);

      if (!textBuffer || !partInfo?.encoding || !partInfo.parameters?.charset) {
        logger.warn(
          `[${this.miningId}:${folderPath}:${msg.uid}:${connection?.id}] Skipping text/plain part: no charset or transfer encoding info available.`
        );
        continue;
      }

      const { encoding, parameters } = partInfo;
      const text = decodeTextPart(
        textBuffer,
        parameters?.charset as BufferEncoding,
        encoding
      );

      // decodeQuotedPrintable(
      //   msg.bodyParts?.get(partId)?.toString() ?? '',
      //   'utf-8'
      // );

      // if (headers && text?.length) {
      //   try {
      //     const { text: parsedText } = await simpleParser(
      //       Buffer.concat([headers, text as Uint8Array<ArrayBufferLike>]),
      //       {
      //         skipHtmlToText: true,
      //         skipTextToHtml: true,
      //         skipImageLinks: true,
      //         skipTextLinks: true
      //       }
      //     );
      //     text = parsedText?.slice(0, this.EMAIL_TEXT_MAX_LENGTH) || '';
      //   } catch {
      //     text = '';
      //   }
      // }

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
    }

    if (publishedEmails > 0) {
      await publishFetchingProgress(
        this.miningId,
        publishedEmails,
        this.isCanceled,
        this.isCompleted
      );
      publishedEmails = 0;
    }
  }

  /**
   * Opens a connection and fetches messages.
   * @param emailJob - The email job to process
   */
  private async processEmailJob(emailJob: EmailJob): Promise<void> {
    if (this.isCanceled) return;

    const { folder, range, totalInFolder, isUid, partId } = emailJob;

    let connection: Connection | null = null;

    try {
      connection = await this.imapConnectionProvider.acquireConnection();

      await connection.mailboxOpen(folder, { readOnly: true });

      logger.info(
        `[${this.miningId}:${folder}:${connection?.id}]: Opened folder for range`
      );

      await this.processFetch(
        connection,
        range,
        isUid,
        partId,
        folder,
        totalInFolder
      );

      await connection.mailboxClose();
      logger.info(
        `[${this.miningId}:${folder}:${connection?.id}]: Closed folder for range`
      );

      if (this.isRefreshingOAuthToken || !connection.usable) {
        // A pending task that is completed (success or failure) , while we're refreshing token.
        // Destroy the connection, since it’s using an expired OAuth token.
        await this.imapConnectionProvider.destroyConnection(connection);
      } else {
        await this.imapConnectionProvider.releaseConnection(connection);
      }
    } catch (error) {
      logger.error(
        `[${this.miningId}:${folder}:${connection?.id}]: ${(error as Error).message}`,
        { error }
      );

      if (connection)
        await this.imapConnectionProvider.destroyConnection(connection);

      if (this.FETCHING_TOTAL_ERRORS >= this.FETCHING_MAX_ERRORS) {
        this.isCanceled = true;
        return;
      }

      this.FETCHING_TOTAL_ERRORS += 1;

      logger.debug(
        `[${this.miningId}:${folder}:${connection?.id}]: Pushing range again to queue for retry`
      );

      this.emailsQueue.add(() =>
        this.processEmailJob({
          range,
          isUid,
          partId,
          folder,
          totalInFolder
        })
      );

      if (
        ImapEmailsFetcher.isAuthFailure(error) &&
        this.imapConnectionProvider.isOAuth()
      ) {
        if (this.isRefreshingOAuthToken) return;

        // Reset total errors
        this.FETCHING_TOTAL_ERRORS = 0;

        this.isRefreshingOAuthToken = true;

        logger.warn('Has Auth Error & is Refreshing OAuth token');

        this.emailsQueue.pause();
        // Wait until all other pending tasks (except this one) have finished resolving

        while (this.emailsQueue.pending > 1) {
          // eslint-disable-next-line no-await-in-loop, no-promise-executor-return
          await new Promise((r) => setTimeout(r, 50));
        }
        const success = await this.imapConnectionProvider.refreshOauth();

        if (!success) {
          this.isCanceled = !success; // cancel task if it fails to refresh
        } else {
          // to avoid refreshing pool on every connection
          this.isRefreshingOAuthToken = false;
        }
        this.emailsQueue.start();
      }
    }
  }

  /**
   * Starts fetching email messages.
   */
  start() {
    if (this.fetchEmailBody) return this.fetchEmailMessagesWithBody();
    return this.fetchEmailMessages();
  }

  private async notifySubscribers() {
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

    await publishFetchingProgress(
      this.miningId,
      0,
      this.isCanceled,
      this.isCompleted
    );

    logger.info(
      `[${this.miningId}] Notified progress: Fetching is ${this.isCanceled ? 'canceled' : 'stopped'} with total fetched: ${this.totalFetched}`
    );
  }

  private async cleanup() {
    await redisClient.unlink(this.processSetKey);
    logger.debug(
      `Cleaned redis cache with id: ${this.processSetKey} and imap pool`
    );

    await this.imapConnectionProvider.cleanPool();
    logger.debug('Cleaned imap connections pool');
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
      await this.emailsQueue.onIdle();
      logger.debug(`[${this.miningId}] Awaited email queue to idle`);
      await this.cleanup();
      await this.notifySubscribers();
      return this.isCompleted;
    } catch (error) {
      logger.error(`[${this.miningId}] Error during stop process:`, error);
      await this.cleanup();
      await this.notifySubscribers();
      throw error;
    }
  }
}
