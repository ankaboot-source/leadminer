import { parseHeader } from 'imap';
import { ImapFlow as Connection, FetchMessageObject } from 'imapflow';
import PQueue from 'p-queue';
import assert from 'assert';
import { EXCLUDED_IMAP_FOLDERS } from '../../utils/constants';
import hashEmail from '../../utils/helpers/hashHelpers';
import logger from '../../utils/logger';
import ImapConnectionProvider from './ImapConnectionProvider';
import ENV from '../../config';
import redis from '../../utils/redis';
import { getMessageId } from '../../utils/helpers/emailHeaderHelpers';
import {
  decodeTextPart,
  findPlainTextNode,
  groupMessagesByTextPart
} from './parsing';
import { planFolderFetch, type WatermarkPolicy } from './folderPlan';
import { buildWatermarkCursor } from './watermark';
import type { ImapResumeCursor, ImapWatermarkCursor } from './types';

const redisClient = redis.getClient();

interface Worker {
  folder: string;
  totalInFolder: number;
  seqRange?: string;
  uidRange?: string;
  bodyParts?: string[];
}

interface Fetch {
  connection: Connection;
  folder: string;
  totalInFolder: number;
  seqRange?: string;
  uidRange?: string;
  bodyParts?: string[];
}

interface PublishBody {
  folder: string;
  totalInFolder: number;
  message: FetchMessageObject;
  selectedBodyParts: string[];
  header: Record<string, string[]>;
}

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
 * @param watermark - Optional per-folder UID watermark emitted on the final message.
 */
async function publishFetchingProgress(
  miningId: string,
  fetchedMessagesCount: number,
  isCanceled: boolean,
  isCompleted: boolean,
  watermark?: ImapWatermarkCursor
) {
  const progress = {
    miningId,
    count: fetchedMessagesCount,
    progressType: 'fetched',
    isCompleted,
    isCanceled,
    ...(watermark ? { watermark } : {})
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

export default class ImapEmailsFetcher {
  public isCanceled: boolean;

  public isCompleted: boolean;

  private requestedCancel: boolean;

  private totalFetched: number;

  private isRefreshingOAuthToken = false;

  private FETCHING_MAX_ERRORS: number;

  private FETCHING_TOTAL_ERRORS: number;

  private totalSignaturesPublished: number;

  private readonly emailsQueue: PQueue;

  private readonly processSetKey: string;

  private readonly userIdentifier: string;

  private readonly fetchedIds: Set<string>;

  /** Highest UID streamed per folder this run; used to build the next watermark. */
  private readonly maxUidPerFolder: Map<string, number>;

  /** Current mailbox uidvalidity per folder; folded into the emitted watermark. */
  private readonly uidValidityPerFolder: Map<string, string>;

  /** Mailbox EXISTS per folder at open time; folded into the emitted watermark. */
  private readonly messageCountPerFolder: Map<string, number>;

  /**
   * Per-folder watermark policy chosen by the fetch planner. Only `advance`
   * folders (full/uid-resume scans) may move the persisted cursor; date-filtered
   * `since` scans are `preserve-or-omit`.
   */
  private readonly watermarkPolicyPerFolder: Map<string, WatermarkPolicy>;

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
    public readonly imapConnectionProvider: ImapConnectionProvider,
    public readonly folders: string[],
    private readonly userId: string,
    private readonly userEmail: string,
    private readonly miningId: string,
    private readonly contactStream: string,
    private readonly signatureStream: string,
    private readonly fetchEmailBody: boolean,
    private readonly batchSize: number,
    private readonly maxBodyTextSize: number | undefined,
    private readonly since: string | undefined,
    private readonly resumeFrom: ImapResumeCursor | undefined,
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
    this.requestedCancel = false;

    // Error Tracking
    this.FETCHING_TOTAL_ERRORS = 0;
    this.FETCHING_MAX_ERRORS = maxConcurrentConnections * 1.5;

    // Signature counter
    this.totalSignaturesPublished = 0;

    this.fetchedIds = new Set<string>();
    this.maxUidPerFolder = new Map<string, number>();
    this.uidValidityPerFolder = new Map<string, string>();
    this.messageCountPerFolder = new Map<string, number>();
    this.watermarkPolicyPerFolder = new Map<string, WatermarkPolicy>();
    this.emailsQueue = new PQueue({
      concurrency: this.maxConcurrentConnections,
      intervalCap: 1, // only 1 job starts per interval
      interval: 300 // 200ms gap between each job starts
    });
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

  async publishHeader(
    message: FetchMessageObject,
    folder: string,
    totalInFolder: number
  ): Promise<Record<string, string[]> | null> {
    try {
      const { seq, headers } = message;
      const header = parseHeader((headers as Buffer).toString('utf8'));
      const messageId = getMessageId(header);
      header['message-id'] = [messageId];

      const isLastMessageInFolder = seq === totalInFolder;

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

  async publishBody({
    header,
    message,
    folder,
    selectedBodyParts
  }: PublishBody) {
    try {
      const { uid, seq, envelope, bodyParts, bodyStructure } = message;

      if (!selectedBodyParts.length) {
        logger.warn(
          `[${this.miningId}:${folder}:${uid}] Skipping.., bodyParts to fetch are not supplied.`
        );
        return;
      }

      const date = envelope?.date;
      const from = envelope?.from?.pop();
      const [partId] = selectedBodyParts;
      const [messageId] = header['message-id'];
      const textBuffer = bodyParts?.get(partId);
      const partInfo = findPlainTextNode(bodyStructure);

      if (!textBuffer || !partInfo?.encoding || !partInfo.parameters?.charset) {
        logger.warn(
          `[${this.miningId}:${folder}:${uid}] Skipping text/plain part: no charset or transfer encoding info available.`
        );
        return;
      }

      const { encoding, parameters } = partInfo;
      const text = decodeTextPart(
        textBuffer,
        parameters?.charset as BufferEncoding,
        encoding
      );

      if (text.length && from && date) {
        // Increment counter for each signature-worthy email published
        const { address, name } = from;
        await publishToStream(this.signatureStream, {
          type: 'email',
          data: {
            header: {
              from: { address: address?.toLowerCase(), name },
              messageId,
              messageDate: date,
              rawHeader: header
            },
            body: text,
            seqNumber: seq,
            folderPath: folder,
            isLast: false
          },
          userId: this.userId,
          userEmail: this.userEmail,
          userIdentifier: this.userIdentifier,
          miningId: this.miningId
        });
        this.totalSignaturesPublished++;
      }
    } catch (error) {
      logger.error('Error when publishing email body', { error });
      throw error;
    }
  }

  async fetch({
    connection,
    folder,
    totalInFolder,
    seqRange,
    uidRange,
    bodyParts
  }: Fetch) {
    let range: string;
    let publishedEmails = 0;

    const batchSize = Math.max(this.batchSize, 200);

    if (seqRange) {
      range = seqRange;
    } else if (uidRange) {
      range = uidRange;
    } else {
      throw new Error(
        'Invalid fetch parameters: either "seqRange" or "uidRange" must be provided.'
      );
    }

    const stream = connection.fetch(
      range,
      {
        source: false,
        envelope: true,
        headers: true,
        bodyStructure: true,
        bodyParts
      },
      {
        uid: Boolean(uidRange)
      }
    );

    for await (const msg of stream) {
      if (this.isCanceled) {
        logger.debug(
          `[${this.miningId}:${folder}]: Received cancellation signal, aborting... `
        );
        connection.close();
        break;
      }

      const header = await this.publishHeader(msg, folder, totalInFolder);

      if (!header) continue;

      const [messageId] = header['message-id'];
      this.fetchedIds.add(messageId);
      this.totalFetched += 1;
      publishedEmails += 1;

      // Track the highest UID streamed for this folder so the completion
      // watermark can advance per-folder (only meaningful for uidRange jobs).
      if (typeof msg.uid === 'number') {
        const currentMax = this.maxUidPerFolder.get(folder) ?? 0;
        if (msg.uid > currentMax) {
          this.maxUidPerFolder.set(folder, msg.uid);
        }
      }

      if (publishedEmails >= batchSize) {
        await publishFetchingProgress(
          this.miningId,
          publishedEmails,
          this.isCanceled,
          this.isCompleted
        );
        publishedEmails = 0;
      }

      if (
        this.fetchEmailBody &&
        bodyParts?.length &&
        msg.envelope?.from?.[0]?.address !== this.userEmail
      )
        await this.publishBody({
          header,
          folder,
          totalInFolder,
          message: msg,
          selectedBodyParts: bodyParts
        });
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

  async fetchWithBody({
    connection,
    folder,
    totalInFolder,
    seqRange,
    uidRange
  }: Fetch) {
    assert(connection, 'fetchWithBody: IMAP connection must be provided.');
    assert(folder, 'fetchWithBody: folder name must be specified.');
    assert(
      typeof totalInFolder === 'number' && totalInFolder >= 0,
      'fetchWithBody: totalInFolder must be a valid non-negative number.'
    );

    const range = (seqRange ?? uidRange) as string;
    assert(
      range,
      'fetchWithBody: sequence range (seqRange) or UID range (uidRange) is required.'
    );

    logger.debug(
      `[${this.miningId}:${folder}:${range}] Starting bodyStructure fetch for ${totalInFolder} emails`
    );

    // Imapflow's fetchAll(range, query, options) interprets `range` as UID
    // numbers only when `options.uid` (3rd arg) is set — putting `uid` in the
    // query would run the range as sequence numbers and fetch the wrong
    // messages on the incremental (resume) path.
    const stream = await connection.fetchAll(
      range,
      {
        bodyStructure: true,
        source: false,
        headers: false
      },
      { uid: Boolean(uidRange) }
    );

    const filteredMessages = groupMessagesByTextPart(
      stream,
      this.maxBodyTextSize
    );

    filteredMessages.forEach(([bodyParts, uids]) => {
      const uidList = Array.from(uids);
      this.emailsQueue.add(
        () =>
          this.worker(
            {
              folder,
              bodyParts,
              totalInFolder,
              uidRange: uidList.join(',')
            },
            this.fetch.bind(this)
          ),
        { priority: 1 }
      );
    });
  }

  /**
   * Fetches all email messages in the configured boxes.
   */
  async fetchEmailMessages() {
    const emailJobs: Worker[] = [];

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

          // Capture mailbox identity + next predicted UID for the watermark.
          if (mailbox.uidValidity !== undefined) {
            this.uidValidityPerFolder.set(folder, String(mailbox.uidValidity));
          }
          this.messageCountPerFolder.set(folder, totalInFolder);

          const resume = this.resumeFrom?.folders?.[folder];

          // Plan while the mailbox is still open: the injected SEARCH SINCE
          // must run against a selected mailbox (imapflow returns undefined on
          // a closed one), otherwise the fallback silently fetches nothing.
          const plan = await planFolderFetch({
            folder,
            exists: totalInFolder,
            uidValidity: mailbox.uidValidity,
            uidNext: mailbox.uidNext,
            resume,
            since: this.since,
            chunkSize: ENV.FETCHING_CHUNK_SIZE_PER_CONNECTION,
            searchUids: async (since) =>
              (await connection.search({ since }, { uid: true })) || []
          });

          // Empty folders still contribute a valid mailbox identity. They may
          // persist last_uid: 0 after a successful run so they are
          // distinguishable from folders that have never been mined.
          await connection.mailboxClose();

          this.watermarkPolicyPerFolder.set(folder, plan.watermarkPolicy);

          if (
            resume &&
            plan.kind !== 'uid-resume' &&
            String(resume.uidvalidity) !== String(mailbox.uidValidity)
          ) {
            logger.warn(
              `[${this.miningId}:${folder}] Resume cursor uidvalidity mismatch (resumed=${resume.uidvalidity}, live=${String(mailbox.uidValidity)}); falling back to legacy fetch and rebuilding watermark`
            );
          }

          if (plan.kind === 'uid-resume') {
            logger.info(
              `[${this.miningId}:${folder}] Resuming UID ranges (${plan.ranges.length} range(s)): ${plan.ranges[0] ?? 'none'}${
                plan.ranges.length > 1
                  ? ` .. ${plan.ranges[plan.ranges.length - 1]}`
                  : ''
              }`
            );
          } else if (plan.kind === 'since') {
            logger.info(
              `[${this.miningId}:${folder}] Found ${plan.ranges.length} UID range(s) since ${this.since}`
            );
          } else if (plan.kind === 'skip') {
            if (plan.reason === 'no-matches') {
              logger.info(
                `No new emails since ${this.since} in folder ${folder}`
              );
            }
            return;
          }

          logger.debug(
            `Preparing ${plan.ranges.length} ranges for total folder emails ${totalInFolder} to pushed to queue`
          );
          plan.ranges.forEach((range) => {
            emailJobs.push({
              folder,
              uidRange: plan.useUid ? range : undefined,
              seqRange: plan.useUid ? undefined : range,
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
        this.emailsQueue.add(() =>
          this.worker(
            job,
            this.fetchEmailBody
              ? this.fetchWithBody.bind(this)
              : this.fetch.bind(this)
          )
        )
      );

      await this.emailsQueue.onIdle();

      this.isCompleted = true;

      if (!this.requestedCancel) {
        // This should be only triggered when fetch internally completes or cancels
        await this.stop(this.isCanceled);
      }

      logger.info(`[${this.miningId}] All email jobs completed`);
    } catch (err) {
      logger.error(err);
    }
  }

  /**
   * Opens a connection and fetches messages.
   * @param emailJob - The email job to process
   */
  private async worker(
    emailJob: Worker,
    workerFn: (options: Fetch) => Promise<void>
  ): Promise<void> {
    if (this.isCanceled) return;

    const { folder, seqRange, uidRange, totalInFolder, bodyParts } = emailJob;

    let connection: Connection | null = null;

    try {
      connection = await this.imapConnectionProvider.acquireConnection();

      await connection.mailboxOpen(folder, { readOnly: true });

      logger.info(
        `[${this.miningId}:${folder}:${connection?.id}]: Opened folder for range`
      );

      await workerFn({
        folder,
        totalInFolder,
        connection,
        seqRange,
        uidRange,
        bodyParts
      });

      logger.info(
        `[${this.miningId}:${folder}:${connection?.id}]: Closed folder for range`
      );

      if (this.isRefreshingOAuthToken || !connection.usable) {
        // A pending task that is completed (success or failure) , while we're refreshing token.
        // Destroy the connection, since it’s using an expired OAuth token.
        await this.imapConnectionProvider.destroyConnection(connection);
      } else {
        await connection.mailboxClose();
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
        logger.warn(
          `[${this.miningId}:${folder}] Max errors reached (${this.FETCHING_TOTAL_ERRORS}/${this.FETCHING_MAX_ERRORS}), canceling`
        );
        return;
      }

      this.FETCHING_TOTAL_ERRORS += 1;

      logger.warn(
        `[${this.miningId}] Retry ${seqRange || uidRange} in ${folder} after error (${this.FETCHING_TOTAL_ERRORS}/${this.FETCHING_MAX_ERRORS} total errors)`
      );

      this.emailsQueue.add(() => this.worker(emailJob, workerFn));

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
    return this.fetchEmailMessages();
  }

  /**
   * Builds the next watermark from this run's observed per-folder UIDs.
   * Emitted once on completion/cancel so callers can persist it centrally.
   */
  private buildWatermark(): ImapWatermarkCursor | undefined {
    return buildWatermarkCursor({
      uidValidityPerFolder: this.uidValidityPerFolder,
      maxUidPerFolder: this.maxUidPerFolder,
      messageCountPerFolder: this.messageCountPerFolder,
      watermarkPolicyPerFolder: this.watermarkPolicyPerFolder,
      resumeFrom: this.resumeFrom
    });
  }

  private async notifyCompleted() {
    const watermark = this.buildWatermark();

    logger.info(
      `[${this.miningId}] Built ${watermark ? Object.keys(watermark.folders).length : 0} folder watermark(s)`
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
          isLast: true,
          totalSignatures: this.totalSignaturesPublished
        },
        userId: this.userId,
        userEmail: this.userEmail,
        userIdentifier: this.userIdentifier,
        miningId: this.miningId
      })
    );

    logger.info(
      `[${this.miningId}] Notified signature stream: This is the last published message with ${this.totalSignaturesPublished} total signatures.`
    );

    await publishFetchingProgress(
      this.miningId,
      0,
      this.isCanceled,
      this.isCompleted,
      watermark
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
      this.requestedCancel = true;
      this.isCanceled = true;
      logger.debug(`[${this.miningId}] Triggered cancel`);
    }

    try {
      await this.emailsQueue.onIdle();
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
}
