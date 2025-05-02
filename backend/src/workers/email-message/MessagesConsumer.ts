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
import { EmailSignatureData } from '../email-signature/handler';
import ENV from '../../config';

export interface PubSubMessage {
  miningId: string;
  command: 'REGISTER' | 'DELETE';
  messagesStream: string;
  messagesConsumerGroup: string;
  emailsVerificationStream: string;
  emailsSignatureStream: string;
}

interface StreamEntry {
  emailsStreamProducer: StreamProducer<EmailVerificationData>;
  emailsSignatureProducer: StreamProducer<EmailSignatureData>;
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
      emailsSignatureProducer: StreamProducer<EmailSignatureData>,
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
        const signatureStream = `signature_stream-${miningId}`;
        if (messagesStream && emailMessagesStreamsConsumer) {
          if (command === 'REGISTER') {
            await this.pubsubStreamCreate(
              signatureStream,
              ENV.REDIS_SIGNATURE_STREAM_CONSUMER_GROUP
            );

            const emailsSignatureProducer =
              new RedisStreamProducer<EmailSignatureData>(
                redisClient,
                signatureStream,
                this.logger
              );

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
              emailsSignatureProducer,
              queuedEmailsCache
            });
          } else {
            await this.pubsubStreamDestroy(
              signatureStream,
              ENV.REDIS_SIGNATURE_STREAM_CONSUMER_GROUP
            );
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

  private async pubsubStreamDestroy(streamName: string, consumerGroup: string) {
    await this.redisClient.xgroup('DESTROY', streamName, consumerGroup);
    await this.redisClient.del(streamName);
  }

  private async pubsubStreamCreate(streamName: string, consumerGroup: string) {
    await this.redisClient.xgroup(
      'CREATE',
      streamName,
      consumerGroup,
      '$',
      'MKSTREAM'
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
                  streamEntry.emailsSignatureProducer,
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
    }, 0);
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
