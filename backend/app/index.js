const express = require('express');
const { initializeSentryIfNeeded } = require('./middleware/sentry');
const logger = require('./utils/logger')(module);
const { SSE } = require('express-sse');
const path = require('path');
const { corsMiddleware } = require('./middleware/cors');

const app = express();

initializeSentryIfNeeded(app);

app.use(corsMiddleware);
app.use((_, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  next();
});

// parse requests of content-type - application/json
app.use(express.json());
// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Disable X-POWERED-BY HTTP header
app.disable('x-powered-by');

// simple route when calling api.leadminer.io
app.get('/', (_, res) => {
  return res.json({ message: 'Welcome to leadminer application.' });
});

// attach sse to api/stream endpoint
const sse = new SSE();
app.get('/api/stream', sse.init);
app.get('/logs', (_, res, next) => {
  const filePath = path.resolve(__dirname, '..', 'logs/server.log');

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
require('./routes/imap.routes')(app, sse);

module.exports = { app };
