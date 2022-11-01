const express = require('express');
require('dotenv').config();
const { serverPort } = require('./app/config/server.config');
const http = require('http');
const { initializeSentryIfNeeded } = require('./sentry');
const logger = require('./app/utils/logger')(module);
const db = require('./app/models');
const { EventEmitter } = require('stream');
const SSE = require('express-sse').SSE;
const cors = require('cors');
//init redis
const redisClientForInitialization =
  require('./redis').redisClientForInitialConnection();
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
const app = express();

const server = http.createServer(app);
class MyEmitter extends EventEmitter {}
const event = new MyEmitter();
var corsOptions = {
  origin: ['*'],
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204,
  credentials: true,
  allRoutes: true
};
app.use(cors(corsOptions));
const sse = new SSE();
//*********** █▌█▌ setting response headers BEGIN***********/
app.use((req, res, next) => {
  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Request methods you wish to allow
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS, PUT, PATCH, DELETE'
  );
  // Request headers you wish to allow
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-Requested-With,Content-type,X-imap-login'
  );
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  //res.setHeader('Access-Control-Allow-Credentials', true);
  // Pass to next layer of middleware
  next();
});
//***********setting response headers END █▌█▌***********/

initializeSentryIfNeeded(app);

process.on('uncaughtException', (err) => {
  logger.error(`${err} , ${err.stack}`);
});

// parse requests of content-type - application/json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// simple route when calling api.leadminer.io
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to leadminer application.' });
});
// attach sse to api/stream endpoint
app.get('/api/stream', (req, res) => sse.init(req, res));
app.get('/logs', (req, res, next) => {
  const filePath = `${__dirname}/logs/server.log`;

  res.sendFile(filePath, (err) => {
    /* istanbul ignore if */
    if (err) {
      next(err);
    } else {
      logger.info('Sent the logs..');
    }
  });
});
// The io instance is set in Express so it can be grabbed in a route
require('./app/routes/imap.routes')(app, sse);

//***************█▌█▌ init db and start server BEGIN**********/
db.sequelize
  .sync()
  .then(() => {
    logger.debug('Database initialized ✔️ ');
    //disconnect from redis after initialization
    redisClientForInitialization.disconnect();
    // if successful init then start server
    server.listen(serverPort, () => {
      logger.info(`Server is running on port ${serverPort}.`);
      event.emit('started');
    });
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        logger.error('Address in use, retrying...', { error: e });
      }
    });
  })
  .catch((error) => {
    logger.error('Error initializing database.', { error });
    throw error;
  });
//***************init db and start server END █▌█▌**********/

server.emit('app_started', true);

function stop() {
  server.close();
}
module.exports = { server, stop, event };
