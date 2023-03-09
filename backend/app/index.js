const express = require('express');
const { initializeSentryIfNeeded } = require('./middleware/sentry');
const { corsMiddleware } = require('./middleware/cors');
const { notFound } = require('./middleware/notFound');
const { errorLogger } = require('./middleware/errorLogger');
const { errorHandler } = require('./middleware/errorHandler');
const imapRouter = require('./routes/imap.routes');
const streamRouter = require('./routes/stream.routes');

const app = express();

initializeSentryIfNeeded(app);

app.use(corsMiddleware);

// parse requests of content-type - application/json
app.use(express.json());
// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Disable X-POWERED-BY HTTP header
app.disable('x-powered-by');

app.get('/', (_, res) => {
  return res.json({ message: 'Welcome to leadminer application.' });
});

// Register api endpoints
app.use('/api/imap', streamRouter);
app.use('/api/imap', imapRouter);

app.use(notFound);
app.use(errorLogger);
app.use(errorHandler);

module.exports = { app };
