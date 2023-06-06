import redis from '../../utils/redis';
import ImapEmailsFetcher from '../ImapEmailsFetcher';
import { TasksManager } from '../TasksManager';
import EmailFetcherFactory from '../factory/EmailFetcherFactory';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';
import RealtimeSSE from '../../utils/helpers/sseHelpers';

const tasksManager = new TasksManager(
  redis.getSubscriberClient(),
  redis.getClient(),
  new EmailFetcherFactory(),
  new SSEBroadcasterFactory()
);

export interface Task {
  userId: string;
  miningId: string;
  stream: {
    streamName: string;
    consumerGroupName: string;
  };
  progress: {
    totalMessages: number;
    fetched: number;
    extracted: number;
  };
  fetcher: ImapEmailsFetcher;
  progressHandlerSSE: RealtimeSSE;
}

export default tasksManager;
