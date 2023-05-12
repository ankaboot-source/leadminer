import express, { json, urlencoded } from 'express';
import corsMiddleware from './middleware/cors';
import errorHandler from './middleware/errorHandler';
import errorLogger from './middleware/errorLogger';
import notFound from './middleware/notFound';
import initializeSentryIfNeeded from './middleware/sentry';
import imapRouter from './routes/imap.routes';
import streamRouter from './routes/stream.routes';

const app = express();

initializeSentryIfNeeded(app);

app.use(corsMiddleware);

// parse requests of content-type - application/json
app.use(json());
// parse requests of content-type - application/x-www-form-urlencoded
app.use(urlencoded({ extended: true }));

// Disable X-POWERED-BY HTTP header
app.disable('x-powered-by');

app.get('/', (_, res) =>
  res.json({ message: 'Welcome to leadminer application.' })
);

// Register api endpoints
app.use('/api/imap', streamRouter);
app.use('/api/imap', imapRouter);

app.use(notFound);
app.use(errorLogger);
app.use(errorHandler);

export default app;
