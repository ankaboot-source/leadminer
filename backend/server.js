const logger = require('./app/utils/logger')(module);
const { serverPort } = require('./app/config/server.config');
const db = require('./app/models');
const { app } = require('./app');
const redisClientForInitialization =
  require('./app/utils/redis').redisClientForInitialConnection();

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
  .then(() => {
    logger.debug('Database initialized ✔️ ');
    //disconnect from redis after initialization
    redisClientForInitialization.disconnect();

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
