import redis from '../../utils/redis';
import EmailFetcherFactory from '../factory/EmailFetcherFactory';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';
import { flickrBase58IdGenerator } from './utils';
import TasksManager from './TasksManager';

const taskManagerSingleton = new TasksManager(
  redis.getSubscriberClient(),
  redis.getClient(),
  new EmailFetcherFactory(),
  new SSEBroadcasterFactory(),
  flickrBase58IdGenerator()
);

export default taskManagerSingleton;
