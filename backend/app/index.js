const express = require('express');
const { initializeSentryIfNeeded } = require('./middleware/sentry');
const logger = require('./utils/logger')(module);
const path = require('path');
const { corsMiddleware } = require('./middleware/cors');
const { notFound } = require('./middleware/notFound');
const { errorLogger } = require('./middleware/errorLogger');
const { errorHandler } = require('./middleware/errorHandler');
const imapRouter = require('./routes/imap.routes');
const { sse } = require('./middleware/sse');

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

app.get('/', (_, res) => {
  return res.json({ message: 'Welcome to leadminer application.' });
});

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

app.use('/api/imap', imapRouter);

app.use(notFound);
app.use(errorLogger);
app.use(errorHandler);

module.exports = { app };
