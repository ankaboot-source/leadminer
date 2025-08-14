import { parseHeader } from 'imap';
import { ParsedMail, simpleParser } from 'mailparser';
import { ImapFlow as Connection } from 'imapflow';
import { EXCLUDED_IMAP_FOLDERS } from '../../utils/constants';
import { getMessageId } from '../../utils/helpers/emailHeaderHelpers';
import hashEmail from '../../utils/helpers/hashHelpers';
import logger from '../../utils/logger';
import redis from '../../utils/redis';
import ImapConnectionProvider from './ImapConnectionProvider';
import { EmailMessage } from './types';

const redisClient = redis.getClient();

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

export default class ImapEmailsFetcher {
  private readonly userIdentifier: string;

  private readonly processSetKey: string;

  private readonly fetchedIds = new Set<string>();

  private totalFetched = 0;

  public isCompleted = false;

  private isCanceled = false;

  private readonly bodies = ['HEADER'];

  private process?: Promise<PromiseSettledResult<void>[]>;

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

  private throwOnCancel(folder: string) {
    if (this.isCanceled === true) {
      throw new Error(
        `Canceled process on folder ${folder} with ID ${this.miningId}`
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
    const promises = this.folders.map(async (folder) => {
      let imapConnection: Connection | null = null;

      if (EXCLUDED_IMAP_FOLDERS.includes(folder)) {
        // Skip excluded folders
        return;
      }

      try {
        imapConnection = await this.imapConnectionProvider.acquireConnection();
        logger.debug(`Opened imap folder ${folder}`);

        if (this.isCanceled) {
          // Kill pending promises before starting.
          await this.imapConnectionProvider.releaseConnection(imapConnection);
          return;
        }

        const mailbox = await imapConnection.mailboxOpen(folder, {
          readOnly: true
        });

        if (mailbox.exists > 0) {
          await this.fetchBox(imapConnection, folder, mailbox.exists);
        }
      } catch (error) {
        logger.error('Error when fetching emails', error);
      } finally {
        if (imapConnection) {
          try {
            await imapConnection.mailboxClose();
            logger.debug(`Closed imap folder ${folder}`);
          } catch (err) {
            logger.warn('Error closing mailbox', err);
          }
          await this.imapConnectionProvider.releaseConnection(imapConnection);
        }
      }
    });

    // Wait for all promises to settle before resolving the main promise
    this.process = Promise.allSettled(promises);
    await this.process;

    this.isCompleted = true;

    // Pubsub to ensure event is received and fetching is closed
    await publishFetchingProgress(this.miningId, 0);

    // Set the fetching status to completed and log message
    logger.info(`All fetch promises with ID ${this.miningId} are terminated.`);
  }

  /**
   *
   * @param connection - Open IMAP connection.
   * @param folderPath - Name of the folder locked by the IMAP connection.
   * @param totalInFolder - Total email messages in the folder.
   * @returns
   */
  async fetchBox(
    connection: Connection,
    folderPath: string,
    totalInFolder: number
  ) {
    try {
      let publishedEmails = 0;
      let pipeline = redisClient.multi();

      for await (const msg of connection.fetch('1:*', {
        uid: false,
        envelope: false,
        source: true,
        bodyParts: ["1"],
        bodyStructure:true
      })) {
        this.throwOnCancel(folderPath);
        const textt = msg.bodyParts?.get('1')?.toString('utf8')
        let header: Record<string, string[]> | null = parseHeader(
          (msg.headers as Buffer<ArrayBufferLike>).toString('utf8')
        );
        let parsed: ParsedMail | null = await simpleParser(
          msg.source as Buffer<ArrayBufferLike>,
          {
            skipHtmlToText: true,
            maxHtmlLengthToParse: 0,
            skipTextToHtml: true,
            skipTextLinks: true
          }
        );

        /* eslint-disable no-await-in-loop */
        const text = parsed.text?.slice(0, 4000) || '';
        const from = parsed.from?.value?.[0];
        const date = parsed.date?.toISOString?.() || new Date().toISOString();

        const messageId = getMessageId(header);

        header['message-id'] = [messageId];

        const isLastMessageInFolder = msg.seq === totalInFolder;

        // To prevent loss of progress counter, check that the duplicated message is not the final one in the folder.
        if (this.fetchedIds.has(messageId) && !isLastMessageInFolder) {
          continue;
        }

        await Promise.all([
          pipeline.xadd(
            this.contactStream,
            '*',
            'message',
            JSON.stringify({
              type: 'email',
              data: {
                header,
                body: '',
                seqNumber: msg.seq,
                folderPath,
                isLast: isLastMessageInFolder
              },
              userId: this.userId,
              userEmail: this.userEmail,
              userIdentifier: this.userIdentifier,
              miningId: this.miningId
            })
          ),

          pipeline.xadd(
            this.signatureStream,
            '*',
            'message',
            JSON.stringify({
              type: 'email',
              data: {
                header: from
                  ? {
                      rawHeader: header,
                      from,
                      messageId,
                      messageDate: date
                    }
                  : {},
                body: text,
                seqNumber: msg.seq,
                folderPath,
                isLast: false
              },
              userId: this.userId,
              userEmail: this.userEmail,
              userIdentifier: this.userIdentifier,
              miningId: this.miningId
            })
          )
        ]);

        this.fetchedIds.add(messageId);
        this.totalFetched += 1;
        publishedEmails += 1;

        // Clean references
        parsed = null;
        header = null;

        if (pipeline.length >= this.batchSize) {
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

      /* eslint-disable no-await-in-loop */
    } catch (err) {
      logger.error('Error when reading emails', err);
      throw err;
    }
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
    if (cancel) {
      this.isCanceled = true;
      await this.process;
    }

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

    await redisClient.unlink(this.processSetKey);
    await this.imapConnectionProvider.cleanPool(); // Do it async because it may take up to 30s to close
    return this.isCompleted;
  }
}
