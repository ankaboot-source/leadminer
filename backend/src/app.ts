import * as Sentry from '@sentry/node';
import express, { json, urlencoded } from 'express';
import { SENTRY_ENABLED } from './config';
import { ImapUsers } from './db/ImapUsers';
import { OAuthUsers } from './db/OAuthUsers';
import corsMiddleware from './middleware/cors';
import errorHandler from './middleware/errorHandler';
import errorLogger from './middleware/errorLogger';
import notFound from './middleware/notFound';
import initializeSentry from './middleware/sentry';
import initializeImapRoutes from './routes/imap.routes';
import initializeMiningRoutes from './routes/mining.routes';
import initializeStreamRouter from './routes/stream.routes';
import { TasksManager } from './services/TasksManager';

export default function initializeApp(
  imapUsers: ImapUsers,
  oAuthUsers: OAuthUsers,
  tasksManager: TasksManager
) {
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

  // Register api endpoints
  app.use(
    '/api/imap',
    initializeStreamRouter(tasksManager),
    initializeImapRoutes(imapUsers, oAuthUsers),
    initializeMiningRoutes(oAuthUsers, imapUsers, tasksManager)
  );

  if (SENTRY_ENABLED) {
    app.use(Sentry.Handlers.errorHandler());
  }

  app.use(notFound);
  app.use(errorLogger);
  app.use(errorHandler);

  return app;
}
