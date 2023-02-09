require('dotenv').config();
const logger = require('./app/utils/logger')(module);
const { app } = require('./app');
const { redis } = require('./app/utils/redis');
const { Worker } = require('worker_threads');
const { LEADMINER_API_PORT } = require('./app/config');

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

process.on('uncaughtException', (err) => {
  const { heapTotal, heapUsed } = process.memoryUsage();
  logger.error('uncaughtException', { err });
  logger.error(
    `Heap total: ${(heapTotal / 1024 / 1024 / 1024).toFixed(2)} | Heap used: ${(
      heapUsed /
      1024 /
      1024 /
      1024
    ).toFixed(2)} `
  );

  throw err;
});

(async () => {
  await redis.loadData();
  // eslint-disable-next-line no-unused-vars
  const messageWorker = new Worker('./app/workers/messageWorker.js');
  app.listen(LEADMINER_API_PORT, () => {
    logger.info(`Server is running on port ${LEADMINER_API_PORT}.`);
  });
})();
