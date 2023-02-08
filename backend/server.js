require('dotenv').config();
const logger = require('./app/utils/logger')(module);
const { app } = require('./app');
const { redis } = require('./app/utils/redis');
const { Worker } = require('worker_threads');

const { LEADMINER_API_PORT, REDIS_STREAM_NAME, REDIS_CONSUMER_GROUP_NAME } = require('./app/config/index');

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
  await redis.initProviders();
  await redis.initConsumerGroup(REDIS_STREAM_NAME, REDIS_CONSUMER_GROUP_NAME)
  // eslint-disable-next-line no-unused-vars
  const messageWorker = new Worker('./app/workers/messageWorker.js');
  app.listen(LEADMINER_API_PORT, () => {
    logger.info(`Server is running on port ${LEADMINER_API_PORT}.`);
  });
})();
