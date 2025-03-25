import { Redis } from 'ioredis';
import { Logger } from 'winston';
import RedisSubscriber from '../../utils/pubsub/redis/RedisSubscriber';
import MultipleStreamsConsumer from '../../utils/streams/MultipleStreamsConsumer';
import { SignatureExtractionData } from './signatureExtractionHandlers';

export interface PubSubMessage {
  miningId: string;
  command: 'REGISTER' | 'DELETE';
  signatureStream: string;
  signatureConsumerGroup: string;
}

export default class SignatureExtractionConsumer {
  private isInterrupted: boolean;

  private readonly activeStreams = new Set<string>();

  constructor(
    private readonly taskManagementSubscriber: RedisSubscriber<PubSubMessage>,
    private readonly signatureStreamsConsumer: MultipleStreamsConsumer<SignatureExtractionData>,
    private readonly batchSize: number,
    private readonly signatureProcessor: (
      data: SignatureExtractionData[]
    ) => Promise<void>,
    private readonly redisClient: Redis,
    private readonly logger: Logger
  ) {
    this.isInterrupted = true;
    this.initializeSubscriber();
  }

  private initializeSubscriber() {
    this.taskManagementSubscriber.subscribe(
      ({ miningId, command, signatureStream }) => {
        if (signatureStream) {
          if (command === 'REGISTER') {
            this.activeStreams.add(signatureStream);
          } else {
            this.activeStreams.delete(signatureStream);
          }
        }
        this.logger.debug('Received PubSub signal for signature extraction', {
          miningId,
          command,
          signatureStream
        });
      }
    );
  }

  async consumeFromStreams(streams: string[]) {
    try {
      const result = await this.signatureStreamsConsumer.consume(
        streams,
        this.batchSize
      );

      const promises = result.map(async ({ streamName, data }) => {
        try {
          await this.signatureProcessor(data);
          const miningId = streamName.split('-')[1];
          await this.redisClient.publish(
            miningId,
            JSON.stringify({
              miningId,
              progressType: 'extractedSignatures',
              count: data.length
            })
          );
        } catch (error) {
          this.logger.error('Signature extraction error', {
            error,
            streamName
          });
        }
      });

      await Promise.all(promises);
    } catch (error) {
      this.logger.error('Error consuming signature extraction stream', error);
      throw error;
    }
  }

  async consume() {
    if (this.isInterrupted) return;

    const streams = Array.from(this.activeStreams);
    if (streams.length > 0) {
      try {
        await this.consumeFromStreams(streams);
      } catch (error) {
        this.logger.error('Signature extraction consumption error', error);
      }
    }

    if (!this.isInterrupted) {
      setImmediate(() => this.consume());
    }
  }

  start() {
    this.isInterrupted = false;
    this.consume();
  }

  stop() {
    this.isInterrupted = true;
  }
}
