import * as Sentry from '@sentry/node';

import express, { json, urlencoded } from 'express';

import { Logger } from 'winston';
import AuthResolver from './services/auth/AuthResolver';
import Billing from './utils/billing-plugin';
import { Contacts } from './db/interfaces/Contacts';
import ENV from './config';
import { MiningSources } from './db/interfaces/MiningSources';
import TasksManager from './services/tasks-manager/TasksManager';
import { Users } from './db/interfaces/Users';
import corsMiddleware from './middleware/cors';
import errorHandler from './middleware/errorHandler';
import errorLogger from './middleware/errorLogger';
import initializeAuthRoutes from './routes/auth.routes';
import initializeContactsRoutes from './routes/contacts.routes';
import initializeEnrichmentRoutes from './routes/enrichment.routes';
import initializeImapRoutes from './routes/imap.routes';
import initializeMiningRoutes from './routes/mining.routes';
import initializeSentry from './middleware/sentry';
import initializeStreamRouter from './routes/stream.routes';
import notFound from './middleware/notFound';

export default function initializeApp(
  authResolver: AuthResolver,
  tasksManager: TasksManager,
  miningSources: MiningSources,
  contacts: Contacts,
  userResolver: Users,
  logger: Logger
) {
  const app = express();

  if (ENV.SENTRY_DSN) {
    initializeSentry(app, ENV.SENTRY_DSN, ENV.SENTRY_ENVIRONMENT);
  }

  if (Billing) {
    app.use('/api', Billing.expressRouter(logger));
  }

  app.use(corsMiddleware);

  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ limit: '5mb', extended: true }));

  app.disable('x-powered-by');

  app.get('/', (_, res) =>
    res.json({ message: 'Welcome to leadminer application.' })
  );

  app.use('/api/auth', initializeAuthRoutes(authResolver, userResolver));
  app.use('/api/imap', initializeImapRoutes(authResolver, miningSources));
  app.use('/api/imap', initializeStreamRouter(tasksManager, authResolver));
  app.use(
    '/api/imap',
    initializeMiningRoutes(tasksManager, miningSources, authResolver)
  );
  app.use('/api', initializeContactsRoutes(contacts, authResolver));
  app.use('/api/enrich', initializeEnrichmentRoutes(authResolver));

  if (ENV.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use(notFound);
  app.use(errorLogger);
  app.use(errorHandler);

  return app;
}
