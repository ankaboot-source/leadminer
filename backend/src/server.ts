import './env';

import initializeApp from './app';
import ENV from './config';
import pool from './db/pg';
import PgContacts from './db/pg/PgContacts';
import PgMiningSources from './db/pg/PgMiningSources';
import SupabaseUsers from './db/supabase/users';
import SupabaseAuthResolver from './services/auth/SupabaseAuthResolver';
import EmailStatusVerifierFactory from './services/email-status/EmailStatusVerifierFactory';
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

  const emailStatusVerifier = EmailStatusVerifierFactory.create(ENV, logger);

  const tasksManager = new TasksManager(
    redis.getSubscriberClient(),
    redis.getClient(),
    emailStatusVerifier,
    contacts,
    new EmailFetcherFactory(),
    new SSEBroadcasterFactory(),
    flickrBase58IdGenerator()
  );
  const miningSources = new PgMiningSources(
    pool,
    logger,
    ENV.LEADMINER_API_HASH_SECRET
  );
  const authResolver = new SupabaseAuthResolver(supabaseClient, logger);
  const contactsResolver = new PgContacts(pool, logger);
  const userResolver = new SupabaseUsers(supabaseClient, logger);

  const app = initializeApp(
    authResolver,
    tasksManager,
    miningSources,
    contactsResolver,
    userResolver
  );

  app.listen(ENV.LEADMINER_API_PORT, () => {
    logger.info(`Server is running on port ${ENV.LEADMINER_API_PORT}.`);
  });
})();
