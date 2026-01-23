import { Redis } from 'ioredis';
import { Logger } from 'winston';
import QueuedEmailsCache from '../../services/cache/QueuedEmailsCache';
import RedisQueuedEmailsCache from '../../services/cache/redis/RedisQueuedEmailsCache';
import RedisSubscriber from '../../utils/pubsub/redis/RedisSubscriber';
import MultipleStreamsConsumer from '../../utils/streams/MultipleStreamsConsumer';
import StreamProducer from '../../utils/streams/StreamProducer';
import RedisStreamProducer from '../../utils/streams/redis/RedisStreamProducer';
import { EmailVerificationData } from '../email-verification/emailVerificationHandlers';
import { EmailMessageData } from './emailMessageHandlers';

export interface PubSubMessage {
  miningId: string;
  command: 'REGISTER' | 'DELETE';
  messagesStream: string;
  messagesConsumerGroup: string;
  emailsVerificationStream: string;
}

interface StreamEntry {
  emailsStreamProducer: StreamProducer<EmailVerificationData>;
  queuedEmailsCache: QueuedEmailsCache;
}

export default class MessagesConsumer {
  private isInterrupted: boolean;

  private readonly activeStreams = new Map<string, StreamEntry>();

  constructor(
    private readonly taskManagementSubscriber: RedisSubscriber<PubSubMessage>,
    private readonly emailMessagesStreamsConsumer: MultipleStreamsConsumer<EmailMessageData>,
    private readonly batchSize: number,
    private readonly messageProcessor: (
      data: EmailMessageData,
      emailsStreamProducer: StreamProducer<EmailVerificationData>,
      queuedEmailsCache: QueuedEmailsCache
    ) => void,
    private readonly redisClient: Redis,
    private readonly logger: Logger
  ) {
    this.isInterrupted = true;

    this.taskManagementSubscriber.subscribe(
      async ({
        miningId,
        command,
        messagesStream,
        emailsVerificationStream
      }) => {
        if (messagesStream && emailMessagesStreamsConsumer) {
          if (command === 'REGISTER') {
            const queuedEmailsCache = new RedisQueuedEmailsCache(
              redisClient,
              miningId
            );

            const emailsStreamProducer =
              new RedisStreamProducer<EmailVerificationData>(
                redisClient,
                emailsVerificationStream,
                this.logger
              );

            this.activeStreams.set(messagesStream, {
              emailsStreamProducer,
              queuedEmailsCache
            });
          } else {
            const streamEntry = this.activeStreams.get(messagesStream);
            if (streamEntry) {
              await streamEntry.queuedEmailsCache.destroy();
              this.activeStreams.delete(messagesStream);
            }
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
   * Continuously consumes messages from a Redis stream, processes them and updates the last read message ID
   * @param streams - The name of the Redis stream to consume messages from
   * @returns A Promise that resolves when the stream is consumed successfully, or rejects with an error
   */
  async consumeFromStreams(streams: string[]) {
    try {
      const result = await this.emailMessagesStreamsConsumer.consume(
        streams,
        this.batchSize
      );

      await Promise.allSettled(
        result.map(async ({ streamName, data }) => {
          try {
            const streamEntry = this.activeStreams.get(streamName);
            if (!streamEntry) {
              return null;
            }

            const promises = await Promise.allSettled(
              data.map((message) =>
                this.messageProcessor(
                  message,
                  streamEntry.emailsStreamProducer,
                  streamEntry.queuedEmailsCache
                )
              )
            );

            const miningId = streamName.split('-')[1];
            const extractionProgress = {
              miningId,
              progressType: 'extracted',
              count: promises.length
            };

            this.redisClient.publish(
              miningId,
              JSON.stringify(extractionProgress)
            );

            return promises;
          } catch (err) {
            this.logger.error('Extraction error', err);
            return Promise.reject(err);
          }
        })
      );
    } catch (err) {
      this.logger.error('Error while consuming messages from stream.', err);
      throw err;
    }
  }

  /**
   * Continuously consumes messages from all streams in the registry.
   * @returns A promise that resolves when consumption is complete.
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
   * Starts the stream consumer.
   */
  start() {
    this.isInterrupted = false;
    this.consume();
  }

  /**
   * Stops the stream consumer.
   */
  stop() {
    this.isInterrupted = true;
  }
}
