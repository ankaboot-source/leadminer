import { Redis } from 'ioredis';
import { Logger } from 'winston';
import MultipleStreamsConsumer, {
  StreamData
} from '../MultipleStreamsConsumer';

/**
 * [streamName, [messageId, [messageKey,stringifiedMessageData]][] ][]
 */
type StreamResult = [string, [string, [string, string]][]][];

export default class RedisMultipleStreamsConsumer<T>
  implements MultipleStreamsConsumer<T>
{
  constructor(
    private readonly redisClient: Redis,
    private readonly logger: Logger,
    private readonly consumerName: string,
    private readonly consumerGroup: string
  ) {}

  async consume(streams: string[], count = 1): Promise<StreamData<T>[]> {
    try {
      const streamsResponse = (await this.redisClient.xreadgroup(
        'GROUP',
        this.consumerGroup,
        this.consumerName,
        'COUNT',
        count,
        'BLOCK',
        2000,
        'NOACK',
        'STREAMS',
        ...streams,
        ...new Array(streams.length).fill('>')
      )) as StreamResult;

      if (streamsResponse === null) {
        return [];
      }

      return streamsResponse.map(([streamName, messages]) => {
        const data: T[] = messages.map(
          ([, stringifiedMessagedData]) =>
            JSON.parse(stringifiedMessagedData[1]) as T
        );

        const lastMessage = messages.at(-1);
        if (lastMessage) {
          const lastMessageId = lastMessage[0];
          this.redisClient.xtrim(streamName, 'MINID', lastMessageId);
        }
        return { streamName, data };
      });
    } catch (error) {
      this.logger.warn('Failed reading from streams', error, streams);
      return [];
    }
  }
}
