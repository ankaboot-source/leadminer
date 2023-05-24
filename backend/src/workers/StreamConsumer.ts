import { Redis } from 'ioredis';
import { Logger } from 'winston';

type StreamEntry = { streamName: string; consumerGroupName: string };

export default class StreamConsumer {
  private isInterrupted: boolean;

  private readonly streamsRegistry: Map<string, StreamEntry>;

  /**
   * Creates an instance of StreamConsumer.
   * @param {string} pubsubCommunicationChannel - Redis pub/sub channel used for receiving configuration and commands.
   * @param {string} consumerName - The name of this consumer.
   * @param {number} batchSize - The number of messages to be processed in each batch.
   * @param {function} messageProcessor - The function that will process the messages consumed from the stream.
   */
  constructor(
    private readonly pubsubCommunicationChannel: string,
    private readonly consumerName: string,
    private readonly batchSize: number,
    private readonly messageProcessor: any,
    private readonly redisSubscriber: Redis,
    private readonly redisClient: Redis,
    private readonly logger: Logger
  ) {
    this.pubsubCommunicationChannel = pubsubCommunicationChannel;
    this.messageProcessor = messageProcessor;
    this.consumerName = consumerName;
    this.batchSize = batchSize;
    this.isInterrupted = true;

    this.streamsRegistry = new Map();

    // Subscribe to the Redis channel for stream management.
    this.redisSubscriber.subscribe(pubsubCommunicationChannel, (err) => {
      if (err) {
        logger.error('Failed subscribing to Redis.', err);
        return;
      }
      logger.info('Subscribed to redis channel');
    });

    this.redisSubscriber.on('message', (_, data) => {
      const { miningId, command, streamName, consumerGroupName } =
        JSON.parse(data);

      if (command === 'REGISTER') {
        this.streamsRegistry.set(miningId, { streamName, consumerGroupName });
      } else {
        this.streamsRegistry.delete(miningId);
      }

      // Log the received PubSub signal for debugging purposes.
      this.logger.debug('Received PubSub signal.', {
        metadata: {
          miningId,
          command,
          streamName,
          consumerGroupName
        }
      });
    });
  }

  /**
   * Continuously consumes messages from a Redis stream, processes them and updates the last read message ID
   * @param streams - The name of the Redis stream to consume messages from
   * @param consumerGroupName - The name of the Redis consumer group to read from
   * @returns A Promise that resolves when the stream is consumed successfully, or rejects with an error
   */
  async consumeFromStreams(streams: string[], consumerGroupName: string) {
    try {
      const result = await this.redisClient.xreadgroup(
        'GROUP',
        consumerGroupName,
        this.consumerName,
        'COUNT',
        this.batchSize,
        'BLOCK',
        2000,
        'NOACK',
        'STREAMS',
        ...streams,
        ...new Array(streams.length).fill('>')
      );

      if (result === null) {
        return null;
      }

      const processedData = await Promise.allSettled(
        result.map(async ([streamName, streamMessages]: any) => {
          const messageIds = streamMessages.map(([id]: any) => id);
          const lastMessageId = messageIds.slice(-1)[0];
          try {
            const promises: any = await Promise.allSettled(
              streamMessages.map((message: any) =>
                this.messageProcessor(message)
              )
            );
            const miningId = promises[0].value;
            const extractionProgress = {
              miningId,
              progressType: 'extracted',
              count: promises.length
            };

            this.redisClient.publish(
              miningId,
              JSON.stringify(extractionProgress)
            );

            this.redisClient.xtrim(streamName, 'MINID', lastMessageId);
            return promises;
          } catch (err) {
            return Promise.reject(err);
          }
        })
      );

      const failedExtractions = processedData.filter(
        (p: any) => p.status === 'rejected'
      );

      if (failedExtractions.length > 0) {
        this.logger.debug('Extraction errors', {
          metadata: { failedExtractions }
        });
      }

      return processedData;
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

    const registry = Array.from(this.streamsRegistry.values());
    const streams = registry
      .map(({ streamName }) => streamName)
      .filter(Boolean);

    if (registry.length > 0) {
      try {
        const [{ consumerGroupName }] = registry;

        if (!consumerGroupName || streams.length === 0) {
          throw new Error('Incomplete data from the stream.');
        }

        await this.consumeFromStreams(streams, consumerGroupName);
      } catch (error: any) {
        this.logger.error('An error occurred while consuming streams:', error);
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
