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
import { MiningEngine } from './services/tasks-manager-v2/MiningEngine';
import { flickrBase58IdGenerator } from './services/tasks-manager-v2/utils';
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
  const miningEngine = new MiningEngine({
    redisSubscriber: redis.getSubscriberClient()
  });

  const pipelineDeps = {
    tasksResolver,
    redisPublisher: redis.getClient(),
    sseBroadcasterFactory: new SSEBroadcasterFactory()
  };

  const miningControllerDeps = {
    pipelineDeps,
    emailFetcherClient: new EmailFetcherClient(
      logger,
      ENV.EMAIL_FETCHING_SERVICE_API_TOKEN,
      ENV.EMAIL_FETCHING_SERVICE_URL
    ),
    pstFetcherClient: new PSTFetcherClient(
      logger,
      ENV.EMAIL_FETCHING_SERVICE_API_TOKEN,
      ENV.EMAIL_FETCHING_SERVICE_URL
    ),
    idGenerator: flickrBase58IdGenerator()
  };

  const app = initializeApp(
    authResolver,
    miningEngine,
    miningSources,
    contactsResolver,
    userResolver,
    logger,
    miningControllerDeps
  );

  app.listen(ENV.LEADMINER_API_PORT, () => {
    logger.info(`Server is running on port ${ENV.LEADMINER_API_PORT}.`);
  });
})();
