import './env';

import initializeApp from './app';
import ENV from './config';
import pool from './db/pg';
import PgContacts from './db/pg/PgContacts';
import PgMiningSources from './db/pg/PgMiningSources';
import SupabaseAuthResolver from './services/auth/SupabaseAuthResolver';
import ReacherEmailStatusVerifier from './services/email-status/reacher';
import ReacherClient from './services/email-status/reacher/client';
import tasksManager from './services/tasks-manager';
import logger from './utils/logger';
import redis from './utils/redis';
import supabaseClient from './utils/supabase';
import initializeEmailVerificationWorker from './workers/emailVerificationWorker';

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
  const emailVerificationWorker = initializeEmailVerificationWorker(
    redis.getClient(),
    logger,
    contacts,
    emailStatusVerifier
  );

  emailVerificationWorker.run();

  const authResolver = new SupabaseAuthResolver(supabaseClient, logger);
  const miningSources = new PgMiningSources(
    pool,
    logger,
    ENV.LEADMINER_API_HASH_SECRET
  );

  const app = initializeApp(authResolver, tasksManager, miningSources);

  app.listen(ENV.LEADMINER_API_PORT, () => {
    logger.info(`Server is running on port ${ENV.LEADMINER_API_PORT}.`);
  });
})();
