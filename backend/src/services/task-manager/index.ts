import redis from '../../utils/redis';
import { TasksManager } from './TasksManager';
import EmailFetcherFactory from '../factory/EmailFetcherFactory';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';

const TASK_MANAGER_SINGELTON = new TasksManager(
  redis.getSubscriberClient(),
  redis.getClient(),
  new EmailFetcherFactory(),
  new SSEBroadcasterFactory()
);

export default TASK_MANAGER_SINGELTON;
