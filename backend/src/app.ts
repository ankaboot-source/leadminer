import * as Sentry from '@sentry/node';
import express, { json, urlencoded } from 'express';
import { SENTRY_ENABLED } from './config';
import corsMiddleware from './middleware/cors';
import errorHandler from './middleware/errorHandler';
import errorLogger from './middleware/errorLogger';
import notFound from './middleware/notFound';
import initializeSentry from './middleware/sentry';
import imapRouter from './routes/imap.routes';
import streamRouter from './routes/stream.routes';

const app = express();

if (SENTRY_ENABLED) {
  initializeSentry(app);
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

app.use(corsMiddleware);

app.use(json());
app.use(urlencoded({ extended: true }));

app.disable('x-powered-by');

app.get('/', (_, res) =>
  res.json({ message: 'Welcome to leadminer application.' })
);

app.use('/api/imap', streamRouter);
app.use('/api/imap', imapRouter);

if (SENTRY_ENABLED) {
  app.use(Sentry.Handlers.errorHandler());
}

app.use(notFound);
app.use(errorLogger);
app.use(errorHandler);

export default app;
