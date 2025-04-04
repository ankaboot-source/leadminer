import Connection, { Box, parseHeader } from 'imap';
import replyParser from 'node-email-reply-parser';
import isHtml from 'is-html';
import {
  EXCLUDED_IMAP_FOLDERS,
  SIGNATURE_EXTRACTION_STREAM
} from '../../utils/constants';
import { getMessageId } from '../../utils/helpers/emailHeaderHelpers';
import hashEmail from '../../utils/helpers/hashHelpers';
import logger from '../../utils/logger';
import redis from '../../utils/redis';
import ImapConnectionProvider from './ImapConnectionProvider';
import { EmailMessage } from './types';

const redisClient = redis.getClient();

/**
 * Publishes an email message to a Redis stream.
 * @param multi - Redis multi command object for pipelining.
 * @param streamName - The name of the Redis stream to publish to.
 * @param emailMessage - The email message to publish.
 */
function addEmailMessageToMulti(
  multi: any,
  streamName: string,
  emailMessage: EmailMessage
) {
  multi.xadd(streamName, '*', 'message', JSON.stringify(emailMessage));
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
    private readonly streamName: string,
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

      const totalPromises = folders.map(
        (folder) =>
          new Promise<number>((resolve, reject) => {
            // Opening a box will explicitly close the previously opened one if it exists.
            imapConnection?.openBox(folder, true, (error, box) => {
              if (error) {
                reject(error);
              } else {
                resolve(box.messages.total);
              }
            });
          })
      );

      // Calculate the total number of messages across all folders.
      const totalArray = await Promise.all(totalPromises).catch((error) => {
        throw error;
      });

      for (const val of totalArray) {
        total += val;
      }

      // Close the last opened box.
      await new Promise((resolve, reject) => {
        imapConnection?.closeBox((err: Error) => {
          if (err) {
            logger.error('Error when closing box', err);
            reject(err);
          }
          resolve(true);
        });
      });
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
    const promises = this.folders.map(async (folderPath) => {
      let imapConnection: Connection | null = null;

      if (EXCLUDED_IMAP_FOLDERS.includes(folderPath)) {
        // Skip excluded folders
        return;
      }

      try {
        imapConnection = await this.imapConnectionProvider.acquireConnection();

        if (this.isCanceled) {
          // Kill pending promises before starting.
          await this.imapConnectionProvider.releaseConnection(imapConnection);
          return;
        }

        const openedBox = await new Promise<Box>((resolve, reject) => {
          imapConnection?.openBox(folderPath, true, (error, box) => {
            if (error) {
              logger.error('Error when opening folder', error);
              reject(error);
            }
            resolve(box);
          });
        });

        if (openedBox?.messages?.total > 0) {
          await this.fetchBox(
            imapConnection,
            folderPath,
            openedBox.messages.total
          );
        }
      } catch (error) {
        logger.error('Error when fetching emails', error);
      } finally {
        // Close the mailbox and release the connection
        imapConnection?.closeBox(async (error) => {
          if (error) {
            logger.error('Error when closing box', error);
          }
          if (imapConnection) {
            await this.imapConnectionProvider.releaseConnection(imapConnection);
          }
        });
      }
    });

    // Wait for all promises to settle before resolving the main promise
    this.process = Promise.allSettled(promises);
    await this.process;

    // Set the fetching status to completed and log message
    this.isCompleted = true;
    logger.info(`All fetch promises with ID ${this.miningId} are terminated.`);
  }

  /**
   *
   * @param connection - Open IMAP connection.
   * @param folderPath - Name of the folder locked by the IMAP connection.
   * @param totalInFolder - Total email messages in the folder.
   * @returns
   */
  fetchBox(connection: Connection, folderPath: string, totalInFolder: number) {
    return new Promise((resolve, reject) => {
      const fetchResult = connection.seq.fetch('1:*', {
        bodies: this.bodies
      });

      let messageCounter = 0;

      fetchResult.on('message', (msg, seqNumber) => {
        let header = '';
        let body = '';

        if (this.isCanceled === true) {
          const message = `Canceled process on folder ${folderPath} with ID ${this.miningId}`;
          reject(new Error(message));
          return;
        }

        msg.on('body', (stream, streamInfo) => {
          stream.on('data', (chunk) => {
            if (streamInfo.which.includes('HEADER')) {
              header += chunk;
            } else if (this.fetchEmailBody) {
              // For body chunks, we only need to keep track of the last 20 lines
              // Append the new chunk and then only keep the last part if it gets too large
              body += chunk;

              // Periodically trim the body to avoid memory issues with very large emails
              // Only keep roughly the last 20 lines (estimating ~100 chars per line)
              if (body.length > 3000) {
                const lines = body.split('\n');
                body = lines.slice(Math.max(0, lines.length - 25)).join('\n');
              }
            }
          });
        });

        msg.once('end', async () => {
          const parsedHeader = parseHeader(header);
          const parsedBody = this.fetchEmailBody ? body : '';

          const messageId = getMessageId(parsedHeader);

          parsedHeader['message-id'] = [messageId];

          const isLastMessageInFolder = seqNumber === totalInFolder;

          if (this.fetchedIds.has(messageId) && !isLastMessageInFolder) {
            return;
          }

          this.fetchedIds.add(messageId);
          this.totalFetched += 1;

          const reachedBatchSize = messageCounter === this.batchSize;
          const shouldPublishProgress =
            reachedBatchSize || isLastMessageInFolder;
          messageCounter = reachedBatchSize ? 0 : messageCounter + 1;

          if (shouldPublishProgress) {
            await publishFetchingProgress(this.miningId, this.totalFetched);
          }
          const emailBodyForSignature =
            this.fetchEmailBody && !ImapEmailsFetcher.isHTMLBody(parsedBody)
              ? parsedBody
              : '';

          if (emailBodyForSignature) {
            try {
              const parsedEmail = replyParser(emailBodyForSignature);

              const fragments = parsedEmail.getFragments();

              const signaturePromises = fragments
                .filter(
                  (fragment) => fragment.isSignature() && !fragment.isEmpty()
                )
                .map(async (fragment) => {
                  const signature = fragment.getContent().trim();

                  if (signature.length > 0) {
                    logger.debug(
                      `Signature detected in email ${messageId} using email-reply-parser`,
                      {
                        miningId: this.miningId,
                        signatureLength: signature.length,
                        userEmail: this.userEmail,
                        folderPath
                      }
                    );

                    // Use Redis pipelining for better performance
                    const multi = redisClient.multi();

                    // Add signature message to pipeline
                    addEmailMessageToMulti(multi, SIGNATURE_EXTRACTION_STREAM, {
                      type: 'email',
                      data: {
                        header: null,
                        body: signature,
                        seqNumber,
                        folderPath,
                        isLast: isLastMessageInFolder
                      },
                      userId: this.userId,
                      userEmail: this.userEmail,
                      userIdentifier: this.userIdentifier,
                      miningId: this.miningId
                    });

                    addEmailMessageToMulti(multi, this.streamName, {
                      type: 'email',
                      data: {
                        header: parsedHeader,
                        body: '',
                        seqNumber,
                        folderPath,
                        isLast: isLastMessageInFolder
                      },
                      userId: this.userId,
                      userEmail: this.userEmail,
                      userIdentifier: this.userIdentifier,
                      miningId: this.miningId
                    });

                    // Execute the pipeline
                    await multi.exec();

                    logger.debug(
                      `Signature sent to stream for email ${messageId}`,
                      {
                        miningId: this.miningId,
                        stream: SIGNATURE_EXTRACTION_STREAM,
                        userEmail: this.userEmail,
                        folderPath
                      }
                    );

                    return true;
                  }
                  return false;
                });

              const signatureResults = await Promise.all(signaturePromises);

              if (!signatureResults.some((result) => result)) {
                logger.debug(
                  `No signature detected in email ${messageId} using email-reply-parser`,
                  {
                    miningId: this.miningId,
                    userEmail: this.userEmail,
                    folderPath
                  }
                );

                // No signature, just send the main email message
                await redisClient.xadd(
                  this.streamName,
                  '*',
                  'message',
                  JSON.stringify({
                    type: 'email',
                    data: {
                      header: parsedHeader,
                      body: '',
                      seqNumber,
                      folderPath,
                      isLast: isLastMessageInFolder
                    },
                    userId: this.userId,
                    userEmail: this.userEmail,
                    userIdentifier: this.userIdentifier,
                    miningId: this.miningId
                  })
                );
              }
            } catch (error) {
              logger.error(
                `Error parsing email signature with node-email-reply-parser for email ${messageId}`,
                {
                  miningId: this.miningId,
                  userEmail: this.userEmail,
                  folderPath,
                  error
                }
              );

              // Fall back to just sending the main email message
              await redisClient.xadd(
                this.streamName,
                '*',
                'message',
                JSON.stringify({
                  type: 'email',
                  data: {
                    header: parsedHeader,
                    body: '',
                    seqNumber,
                    folderPath,
                    isLast: isLastMessageInFolder
                  },
                  userId: this.userId,
                  userEmail: this.userEmail,
                  userIdentifier: this.userIdentifier,
                  miningId: this.miningId
                })
              );
            }
          } else {
            await redisClient.xadd(
              this.streamName,
              '*',
              'message',
              JSON.stringify({
                type: 'email',
                data: {
                  header: parsedHeader,
                  body: '',
                  seqNumber,
                  folderPath,
                  isLast: isLastMessageInFolder
                },
                userId: this.userId,
                userEmail: this.userEmail,
                userIdentifier: this.userIdentifier,
                miningId: this.miningId
              })
            );
          }
        });
      });

      fetchResult.once('error', (err) => {
        logger.error('IMAP fetch error', err);
        reject(err);
      });

      fetchResult.once('end', () => {
        resolve(true);
      });
    });
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
  async stop() {
    this.isCanceled = true;
    await this.process;
    await redisClient.unlink(this.processSetKey);
    await this.imapConnectionProvider.cleanPool(); // Do it async because it may take up to 30s to close
    return this.isCompleted;
  }

  /**
   * Checks if the body of the email is in HTML format.
   * @param body - The email body to check.
   * @returns true if the body contains HTML, false if it doesn't.
   */
  private static isHTMLBody(body: string): boolean {
    // Use the is-html library for more reliable HTML detection
    return isHtml(body);
  }
}
