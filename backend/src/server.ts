import './env';

import initializeApp from './app';
import ENV from './config';
import pool from './db/pg';
import PgContacts from './db/pg/PgContacts';
import PgMiningSources from './db/pg/PgMiningSources';
import SupabaseAuthResolver from './services/auth/SupabaseAuthResolver';
import ReacherEmailStatusVerifier from './services/email-status/reacher';
import ReacherClient from './services/email-status/reacher/client';
import EmailFetcherFactory from './services/factory/EmailFetcherFactory';
import SSEBroadcasterFactory from './services/factory/SSEBroadcasterFactory';
import TasksManager from './services/tasks-manager/TasksManager';
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
  await redis.flushAll();
  await redis.initProviders();
  const contacts = new PgContacts(pool, logger);
  const reacherClient = new ReacherClient(logger, {
    host: ENV.REACHER_HOST,
    apiKey: ENV.REACHER_API_KEY,
    headerSecret: ENV.REACHER_HEADER_SECRET
  });

  const emailStatusVerifier = new ReacherEmailStatusVerifier(
    reacherClient,
    logger
  );
  const tasksManager = new TasksManager(
    redis.getSubscriberClient(),
    redis.getClient(),
    emailStatusVerifier,
    contacts,
    new EmailFetcherFactory(),
    new SSEBroadcasterFactory(),
    flickrBase58IdGenerator()
  );

  const authResolver = new SupabaseAuthResolver(supabaseClient, logger);
  const miningSources = new PgMiningSources(
    pool,
    logger,
    ENV.LEADMINER_API_HASH_SECRET
  );
  const contactsResolver = new PgContacts(
    pool,
    logger
  )
  const app = initializeApp(authResolver, tasksManager, miningSources, contactsResolver);

  app.listen(ENV.LEADMINER_API_PORT, () => {
    logger.info(`Server is running on port ${ENV.LEADMINER_API_PORT}.`);
  });
})();
