const logger = require('./app/utils/logger')(module);
const { serverPort } = require('./app/config/server.config');
const { app } = require('./app');
const { redis } = require('./app/utils/redis');
const { Worker } = require('worker_threads');

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
  await redis.loadData();
  // eslint-disable-next-line no-unused-vars
  const messageWorker = new Worker('./app/workers/messageWorker.js', {
    resourceLimits: { maxOldGenerationSizeMb: 1500 }
  });
  app.listen(serverPort, () => {
    logger.info(`Server is running on port ${serverPort}.`);
  });
})();
