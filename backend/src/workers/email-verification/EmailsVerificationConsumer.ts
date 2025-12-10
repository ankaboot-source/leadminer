import { Redis } from 'ioredis';
import { Logger } from 'winston';
import RedisSubscriber from '../../utils/pubsub/redis/RedisSubscriber';
import MultipleStreamsConsumer from '../../utils/streams/MultipleStreamsConsumer';
import { EmailVerificationData } from './emailVerificationHandlers';

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
    private readonly emailProcessor: (
      data: EmailVerificationData[],
      progressCallback: (verified: number) => Promise<void>
    ) => Promise<void>,
    private readonly redisClient: Redis,
    private readonly logger: Logger
  ) {
    this.isInterrupted = true;

    this.taskManagementSubscriber.subscribe(
      ({ miningId, command, emailsStream }) => {
        if (emailsStream) {
          if (command === 'REGISTER') {
            this.activeStreams.add(emailsStream);
          } else {
            this.activeStreams.delete(emailsStream);
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
            const progressCallback = async (verified: number) => {
              await this.redisClient.publish(
                streamName.split('-')[1],
                JSON.stringify({
                  miningId: streamName.split('-')[1],
                  progressType: 'verifiedContacts',
                  count: verified
                })
              );
            };
            const processed = await this.emailProcessor(data, progressCallback);

            if (!this.activeStreams.has(streamName)) {
              return null;
            }

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
    }, 3000);
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
