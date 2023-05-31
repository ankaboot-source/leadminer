import './env';

import logger from './utils/logger';
import redis from './utils/redis';

import initializeApp from './app';
import ENV from './config';
import pool from './db/pg';
import PgImapUsers from './db/pg/PgImapUsers';
import PgOAuthUsers from './db/pg/PgOAuthUsers';
import tasksManager from './services/singleton/TasksManagerSingleton';

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

  const oAuthUsers = new PgOAuthUsers(pool, logger);
  const imapUsers = new PgImapUsers(pool, logger);

  const app = initializeApp(imapUsers, oAuthUsers, tasksManager);

  app.listen(ENV.LEADMINER_API_PORT, () => {
    logger.info(`Server is running on port ${ENV.LEADMINER_API_PORT}.`);
  });
})();
