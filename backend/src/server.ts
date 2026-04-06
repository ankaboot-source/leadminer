import './env';

import initializeApp from './app';
import ENV from './config';
import pool from './db/pg';
import PgContacts from './db/pg/PgContacts';
import PgMiningSources from './db/pg/PgMiningSources';
import SupabaseTasks from './db/supabase/tasks';
import SupabaseUsers from './db/supabase/users';
import SupabaseAuthResolver from './services/auth/SupabaseAuthResolver';
import EmailFetcherClient from './services/email-fetching';
import PSTFetcherClient from './services/email-fetching/pst';
import SSEBroadcasterFactory from './services/factory/SSEBroadcasterFactory';
import TasksManager from './services/tasks-manager/TasksManager';
import TasksManagerFile from './services/tasks-manager/TasksManagerFile';
import TasksManagerPostgreSQL from './services/tasks-manager/TasksManagerPostgreSQL';
import TasksManagerPST from './services/tasks-manager/TasksManagerPST';
import { flickrBase58IdGenerator } from './services/tasks-manager/utils';
import logger from './utils/logger';
import redis from './utils/redis';
import supabaseClient from './utils/supabase';

// eslint-disable-next-line no-console
console.log(
  `%c
    ██╗     ███████╗ █████╗ ██████╗ ███╗   ███╗██╗███╗   ██╗███████╗██████╗ 
    ██║     ██╔════╝██╔══██╗██╔══██╗████╗ ████║██║████╗  ██║██╔════╝██╔══██╗
    ██║     █████╗  ███████║██║  ██║██╔████╔██║██║██╔██╗ ██║█████╗  ██████╔╝
    ██║     ██╔══╝  ██╔══██║██║  ██║██║╚██╔╝██║██║██║╚██╗██║██╔══╝  ██╔══██╗
    ███████╗███████╗██║  ██║██████╔╝██║ ╚═╝ ██║██║██║ ╚████║███████╗██║  ██║
    ╚══════╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝
`,
  'font-family: monospace'
);

(async () => {
  await redis.flushAll([ENV.REDIS_SIGNATURE_STREAM_NAME], ['llm-sig:']);
  await redis.initProviders();

  const miningSources = new PgMiningSources(
    pool,
    logger,
    ENV.LEADMINER_API_HASH_SECRET
  );
  const authResolver = new SupabaseAuthResolver(supabaseClient, logger);
  const contactsResolver = new PgContacts(pool, logger);
  const userResolver = new SupabaseUsers(supabaseClient, logger);
  const tasksResolver = new SupabaseTasks(supabaseClient, logger);
  const tasksManager = new TasksManager(
    tasksResolver,
    redis.getSubscriberClient(),
    redis.getClient(),
    new EmailFetcherClient(
      logger,
      ENV.EMAIL_FETCHING_SERVICE_API_TOKEN,
      ENV.EMAIL_FETCHING_SERVICE_URL
    ),
    new SSEBroadcasterFactory(),
    flickrBase58IdGenerator()
  );
  const tasksManagerFile = new TasksManagerFile(
    tasksResolver,
    redis.getSubscriberClient(),
    redis.getClient(),
    undefined,
    new SSEBroadcasterFactory(),
    flickrBase58IdGenerator()
  );
  const tasksManagerPST = new TasksManagerPST(
    tasksResolver,
    redis.getSubscriberClient(),
    redis.getClient(),
    new PSTFetcherClient(
      logger,
      ENV.EMAIL_FETCHING_SERVICE_API_TOKEN, //! RDNDNT
      ENV.EMAIL_FETCHING_SERVICE_URL
    ),
    new SSEBroadcasterFactory(),
    flickrBase58IdGenerator()
  );
  const tasksManagerPostgreSQL = new TasksManagerPostgreSQL(
    tasksResolver,
    redis.getSubscriberClient(),
    redis.getClient(),
    new SSEBroadcasterFactory()
  );

  const app = initializeApp(
    authResolver,
    tasksManager,
    tasksManagerFile,
    tasksManagerPST,
    tasksManagerPostgreSQL,
    miningSources,
    contactsResolver,
    userResolver,
    logger
  );

  app.listen(ENV.LEADMINER_API_PORT, () => {
    logger.info(`Server is running on port ${ENV.LEADMINER_API_PORT}.`);
  });
})();
