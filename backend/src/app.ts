import * as Sentry from '@sentry/node';
import express, { json, urlencoded } from 'express';
import ENV from './config';
import { MiningSources } from './db/MiningSources';
import corsMiddleware from './middleware/cors';
import errorHandler from './middleware/errorHandler';
import errorLogger from './middleware/errorLogger';
import notFound from './middleware/notFound';
import initializeSentry from './middleware/sentry';
import initializeImapRoutes from './routes/imap.routes';
import initializeMiningRoutes from './routes/mining.routes';
import initializeStreamRouter from './routes/stream.routes';
import AuthResolver from './services/auth/AuthResolver';
import TasksManager from './services/tasks-manager/TasksManager';

export default function initializeApp(
  authResolver: AuthResolver,
  tasksManager: TasksManager,
  miningSources: MiningSources
) {
  const app = express();

  if (ENV.SENTRY_DSN) {
    initializeSentry(app, ENV.SENTRY_DSN);
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

  app.use('/api/imap', initializeImapRoutes(authResolver, miningSources));
  app.use('/api/imap', initializeStreamRouter(tasksManager));
  app.use(
    '/api/imap',
    initializeMiningRoutes(tasksManager, miningSources, authResolver)
  );

  if (ENV.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
  }

  app.use(notFound);
  app.use(errorLogger);
  app.use(errorHandler);

  return app;
}
