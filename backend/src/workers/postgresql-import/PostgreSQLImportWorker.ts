import { Redis } from 'ioredis';
import { Logger } from 'winston';
import ENV from '../../config';
import { PostgreSQLMiningSourceCredentials } from '../../db/interfaces/MiningSources';
import { PostgresQueryService } from '../../services/postgresql/PostgresQueryService';
import RedisSubscriber from '../../utils/pubsub/redis/RedisSubscriber';
import RedisStreamProducer from '../../utils/streams/redis/RedisStreamProducer';
import StreamProducer from '../../utils/streams/StreamProducer';

export interface PostgreSQLImportMessage {
  type: 'postgresql';
  miningId: string;
  userId: string;
  userEmail: string;
  data: {
    query: string;
    mapping: Record<string, string>;
    credentials: PostgreSQLMiningSourceCredentials;
    sourceName: string;
  };
}

export interface PubSubMessage {
  miningId: string;
  command: 'REGISTER' | 'DELETE';
  messagesStream: string;
  messagesConsumerGroup: string;
  emailsVerificationStream: string;
}

interface StreamEntry {
  producer: StreamProducer<unknown>;
}

function mapRowToContact(
  row: Record<string, unknown>,
  mapping: Record<string, string>
): Record<string, unknown> {
  const contact: Record<string, unknown> = {};

  for (const [column, field] of Object.entries(mapping)) {
    if (row[column] !== undefined && row[column] !== null) {
      contact[field] = row[column];
    }
  }

  // Ensure email is present
  if (!contact.email) {
    throw new Error('Email field is required but not found in mapped data');
  }

  return contact;
}

export default class PostgreSQLImportWorker {
  private isInterrupted: boolean;

  private readonly activeStreams = new Map<string, StreamEntry>();

  constructor(
    private readonly taskManagementSubscriber: RedisSubscriber<PubSubMessage>,
    private readonly redisClient: Redis,
    private readonly logger: Logger,
    private readonly batchSize: number = 100
  ) {
    this.isInterrupted = true;

    this.taskManagementSubscriber.subscribe(
      async ({
        miningId,
        command,
        messagesStream,
        emailsVerificationStream
      }) => {
        if (messagesStream) {
          if (command === 'REGISTER') {
            const producer = new RedisStreamProducer<unknown>(
              redisClient,
              emailsVerificationStream,
              this.logger
            );

            this.activeStreams.set(messagesStream, {
              producer
            });
          } else {
            this.activeStreams.delete(messagesStream);
          }
        }

        this.logger.debug('Received PubSub signal.', {
          metadata: {
            miningId,
            command,
            messagesStream,
            emailsVerificationStream
          }
        });
      }
    );
  }

  /**
   * Processes a single PostgreSQL import message
   */
  async processMessage(message: PostgreSQLImportMessage): Promise<void> {
    const { miningId, userId, data } = message;
    const { query, mapping, credentials, sourceName } = data;

    this.logger.info('Starting PostgreSQL import', {
      miningId,
      userId,
      sourceName
    });

    const queryService = new PostgresQueryService(credentials);
    const streamEntry = this.activeStreams.get(`messages_stream-${miningId}`);

    if (!streamEntry) {
      throw new Error(`No active stream found for miningId: ${miningId}`);
    }

    const { producer } = streamEntry;
    let totalExtracted = 0;

    try {
      for await (const batch of queryService.executeQueryStream(
        query,
        this.batchSize
      )) {
        const contacts = batch.rows.map((row) => {
          try {
            return mapRowToContact(row, mapping);
          } catch (error) {
            this.logger.warn('Failed to map row to contact', {
              row,
              error: (error as Error).message
            });
            return null;
          }
        });

        // Filter out nulls from failed mappings
        const validContacts = contacts.filter(
          (c): c is Record<string, unknown> => c !== null
        );

        if (validContacts.length > 0) {
          await producer.produce(validContacts);
          totalExtracted += validContacts.length;

          // Publish progress update
          await this.redisClient.publish(
            miningId,
            JSON.stringify({
              miningId,
              progressType: 'extracted',
              count: validContacts.length
            })
          );

          this.logger.debug('Published contacts batch', {
            miningId,
            batchSize: validContacts.length,
            totalExtracted
          });
        }
      }

      this.logger.info('PostgreSQL import completed', {
        miningId,
        userId,
        sourceName,
        totalExtracted
      });
    } catch (error) {
      this.logger.error('PostgreSQL import failed', {
        miningId,
        userId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Checks if a stream is for PostgreSQL import
   */
  private isPostgreSQLStream(streamName: string): boolean {
    // PostgreSQL streams follow the pattern messages_stream-{miningId}
    // We'll check if the stream is in our active streams map
    return this.activeStreams.has(streamName);
  }

  /**
   * Consumes messages from Redis streams
   */
  async consumeFromStreams(streams: string[]) {
    try {
      const result = (await this.redisClient.xreadgroup(
        'GROUP',
        ENV.REDIS_EXTRACTING_STREAM_CONSUMER_GROUP,
        'postgresql-import-worker',
        'COUNT',
        this.batchSize,
        'BLOCK',
        2000,
        'NOACK',
        'STREAMS',
        ...streams,
        ...new Array(streams.length).fill('>')
      )) as [string, [string, [string, string]][]][] | null;

      if (!result || !Array.isArray(result)) {
        return;
      }

      for (const [streamName, messages] of result) {
        const streamEntry = this.activeStreams.get(streamName);
        if (!streamEntry) {
          continue;
        }

        for (const [, [, stringifiedMessage]] of messages) {
          try {
            const message = JSON.parse(
              stringifiedMessage
            ) as PostgreSQLImportMessage;
            await this.processMessage(message);
          } catch (error) {
            this.logger.error('Failed to process message', {
              streamName,
              error: (error as Error).message
            });
          }
        }

        // Trim processed messages
        const lastMessage = messages.at(-1);
        if (lastMessage) {
          const lastMessageId = lastMessage[0];
          await this.redisClient.xtrim(streamName, 'MINID', lastMessageId);
        }
      }
    } catch (err) {
      this.logger.error('Error while consuming messages from stream.', err);
      throw err;
    }
  }

  /**
   * Continuously consumes messages from all streams in the registry.
   */
  async consume() {
    if (this.isInterrupted) {
      return;
    }

    const streams = Array.from(this.activeStreams.keys());

    if (streams.length > 0) {
      try {
        await this.consumeFromStreams(streams);
      } catch (error) {
        this.logger.error(
          'An error occurred while consuming streams:',
          error as Error
        );
      }
    }

    setTimeout(() => {
      this.consume();
    }, 1000);
  }

  /**
   * Starts the worker.
   */
  start() {
    this.isInterrupted = false;
    this.logger.info('PostgreSQL import worker started');
    this.consume();
  }

  /**
   * Stops the worker.
   */
  stop() {
    this.isInterrupted = true;
    this.logger.info('PostgreSQL import worker stopped');
  }
}
