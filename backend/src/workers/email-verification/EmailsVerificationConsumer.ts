import { Redis } from 'ioredis';
import { Logger } from 'winston';
import RedisSubscriber from '../../utils/pubsub/redis/RedisSubscriber';
import MultipleStreamsConsumer from '../../utils/streams/MultipleStreamsConsumer';
import {
  EmailVerificationData,
  EmailVerificationHandler
} from './emailVerificationHandlers';

export interface PubSubMessage {
  miningId: string;
  command: 'REGISTER' | 'DELETE';
  emailsStream: string;
  emailsConsumerGroup: string;
}

export default class EmailVerificationConsumer {
  private isInterrupted: boolean;

  private readonly activeStreams = new Set<string>();

  constructor(
    private readonly taskManagementSubscriber: RedisSubscriber<PubSubMessage>,
    private readonly emailStreamsConsumer: MultipleStreamsConsumer<EmailVerificationData>,
    private readonly batchSize: number,
    private readonly streamsHandler: EmailVerificationHandler,
    private readonly redisClient: Redis,
    private readonly logger: Logger
  ) {
    this.isInterrupted = true;

    this.taskManagementSubscriber.subscribe(
      ({ miningId, command, emailsStream }) => {
        if (emailsStream) {
          if (command === 'REGISTER') {
            this.activeStreams.add(emailsStream);
            this.streamsHandler.registerStream(emailsStream);
          } else {
            this.activeStreams.delete(emailsStream);
            this.streamsHandler.unregisterStream(emailsStream);
          }
        }

        this.logger.debug('Received PubSub signal.', {
          metadata: {
            miningId,
            command,
            emailsStream
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
      const result = await this.emailStreamsConsumer.consume(
        streams,
        this.batchSize
      );

      await Promise.allSettled(
        result.map(async ({ streamName, data }) => {
          try {
            if (!this.activeStreams.has(streamName)) {
              this.logger.info(
                'Aborting data will not be processed, stream was removed from activeStreams'
              );
              return null;
            }

            this.logger.info(
              `Consuming ${data.length} emails from stream name ${streamName}`
            );

            const processed = await this.streamsHandler.handle(
              streamName,
              data
            );

            return processed;
          } catch (err) {
            this.logger.error('Extraction error', err);
            return Promise.reject(new Error((err as Error).message));
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

    const streams = Array.from(this.activeStreams);

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
    }, 10000);
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
