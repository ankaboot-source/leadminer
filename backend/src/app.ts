import express, { json, urlencoded } from 'express';
import { ImapUsers } from './db/ImapUsers';
import { OAuthUsers } from './db/OAuthUsers';
import corsMiddleware from './middleware/cors';
import errorHandler from './middleware/errorHandler';
import errorLogger from './middleware/errorLogger';
import notFound from './middleware/notFound';
import initializeSentryIfNeeded from './middleware/sentry';
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
  app.use(
    '/api/imap',
    initializeStreamRouter(tasksManager),
    initializeImapRoutes(imapUsers, oAuthUsers),
    initializeMiningRoutes(oAuthUsers, imapUsers, tasksManager)
  );

  app.use(notFound);
  app.use(errorLogger);
  app.use(errorHandler);

  return app;
}
