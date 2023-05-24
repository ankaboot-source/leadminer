import pool from '../../db/pg';
import PgContacts from '../../db/pg/PgContacts';
import logger from '../../utils/logger';
import redis from '../../utils/redis';
import { TasksManager } from '../TasksManager';
import EmailFetcherFactory from '../factory/EmailFetcherFactory';
import SSEBroadcasterFactory from '../factory/SSEBroadcasterFactory';

const tasksManager = new TasksManager(
  redis.getSubscriberClient(),
  redis.getClient(),
  new EmailFetcherFactory(),
  new SSEBroadcasterFactory(),
  new PgContacts(pool, logger)
);

export default tasksManager;
