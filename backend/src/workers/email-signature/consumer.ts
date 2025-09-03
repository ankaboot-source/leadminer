import { Redis } from 'ioredis';
import { Logger } from 'winston';
import RedisSubscriber from '../../utils/pubsub/redis/RedisSubscriber';
import MultipleStreamsConsumer from '../../utils/streams/MultipleStreamsConsumer';
import { EmailData } from './handler';
import { Contact } from '../../db/types';

export interface PubSubMessage {
  miningId: string;
  command: 'REGISTER' | 'DELETE';
  signatureStream: string;
  signatureConsumerGroup: string;
}

export default class EmailSignatureConsumer {
  private isInterrupted: boolean;

  constructor(
    private readonly taskManagementSubscriber: RedisSubscriber<PubSubMessage>,
    private readonly emailStreamsConsumer: MultipleStreamsConsumer<EmailData>,
    private readonly emailSignatureStream: string,
    private readonly batchSize: number,
    private readonly emailProcessor: (
      data: EmailData
    ) => Promise<Partial<Contact>[]>,
    private readonly redisClient: Redis,
    private readonly logger: Logger
  ) {
    this.isInterrupted = true;

    this.taskManagementSubscriber.subscribe(
      ({ miningId, command, signatureStream }) => {
        this.isInterrupted = false;
        this.logger.debug('Received PubSub signal.', {
          metadata: {
            miningId,
            command,
            signatureStream
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

      for (const { streamName, data } of result) {
        for (const emailData of data) {
          /* eslint-disable-next-line no-await-in-loop */
          await this.emailProcessor(emailData);
        }

        const miningId = streamName.split('-')[1];
        const extractionProgress = {
          miningId,
          progressType: 'extractedSignature',
          count: data.length
        };

        this.redisClient.publish(miningId, JSON.stringify(extractionProgress));
      }
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

    try {
      await this.consumeFromStreams([this.emailSignatureStream]);
    } catch (error) {
      this.logger.error(
        'An error occurred while consuming streams:',
        error as Error
      );
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
