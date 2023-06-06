import * as Sentry from '@sentry/node';
import express, { json, urlencoded } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import ENV from './config';
import corsMiddleware from './middleware/cors';
import errorHandler from './middleware/errorHandler';
import errorLogger from './middleware/errorLogger';
import notFound from './middleware/notFound';
import initializeSentry from './middleware/sentry';
import initializeImapRoutes from './routes/imap.routes';
import initializeMiningRoutes from './routes/mining.routes';
import initializeOAuthRoutes from './routes/oauth.routes';
import initializeStreamRouter from './routes/stream.routes';
import { TasksManager } from './services/TasksManager';

export default function initializeApp(
  supabaseRestClient: SupabaseClient,
  tasksManager: TasksManager
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

  // Register api endpoints
  app.use(
    '/api/imap',
    initializeImapRoutes(supabaseRestClient),
    initializeStreamRouter(supabaseRestClient, tasksManager),
    initializeMiningRoutes(supabaseRestClient, tasksManager)
  );
  app.use('/api/oauth', initializeOAuthRoutes(supabaseRestClient));

  if (ENV.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
  }

  app.use(notFound);
  app.use(errorLogger);
  app.use(errorHandler);

  return app;
}
