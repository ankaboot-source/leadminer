const logger = require('./app/utils/logger')(module);
const { serverPort } = require('./app/config/server.config');
const db = require('./app/models');
const { app } = require('./app');
const { redis } = require('./app/utils/redis');

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

db.sequelize
  .sync()
  .then(async () => {
    logger.info('Database initialized ✔️ ');

    await redis.loadData();

    // if successful init then start server
    app.listen(serverPort, () => {
      logger.info(`Server is running on port ${serverPort}.`);
    });

    app.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        logger.error('Address in use, retrying...', { error: e });
      }
    });
  })
  .catch((error) => {
    logger.error('Error initializing database.', { error });
    throw error;
  });
