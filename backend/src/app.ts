import * as Sentry from '@sentry/node';

import express, { json, urlencoded } from 'express';
import hpp from 'hpp';

import util from 'util';
import { Logger } from 'winston';
import ENV from './config';
import { Contacts } from './db/interfaces/Contacts';
import { MiningSources } from './db/interfaces/MiningSources';
import { SmtpSenders } from './db/interfaces/SmtpSenders';

import corsMiddleware from './middleware/cors';
import errorHandler from './middleware/errorHandler';
import errorLogger from './middleware/errorLogger';
import notFound from './middleware/notFound';
import initializeSentry from './middleware/sentry';
import initializeAuthRoutes from './routes/auth.routes';
import initializeContactsRoutes from './routes/contacts.routes';
import initializeEnrichmentRoutes from './routes/enrichment.routes';
import initializeImapRoutes from './routes/imap.routes';
import initializeMiningRoutes from './routes/mining.routes';
import initializeSmtpSendersRoutes from './routes/smtp-senders.routes';
import initializeStreamRouter from './routes/stream.routes';
import AuthResolver from './services/auth/AuthResolver';
import { MiningEngine } from './services/tasks-manager-v2/MiningEngine';
import { MiningControllerDeps } from './controllers/mining.controller';
import Billing from './utils/billing-plugin';
import { miningSourceService } from './db/supabase/MiningSourceService';

export default function initializeApp(
  authResolver: AuthResolver,
  miningEngine: MiningEngine,
  miningSources: MiningSources,
  contacts: Contacts,

  logger: Logger,
  miningControllerDeps: MiningControllerDeps,
  smtpSenders: SmtpSenders
) {
  const app = express();

  if (ENV.SENTRY_DSN_BACKEND) {
    initializeSentry(
      app,
      ENV.SENTRY_DSN_BACKEND,
      ENV.SENTRY_ENVIRONMENT_BACKEND
    );
  }

  if (Billing) {
    app.use('/api', Billing.expressRouter(logger));
  }

  app.use(corsMiddleware);

  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ limit: '5mb', extended: true }));

  app.use(hpp());
  app.disable('x-powered-by');

  app.get('/', (_, res) =>
    res.json({ message: 'Welcome to leadminer application.' })
  );

  app.use('/api/auth', initializeAuthRoutes());
  app.use('/api/imap', initializeImapRoutes(authResolver, miningSourceService));
  app.use('/api/imap', initializeStreamRouter(miningEngine, authResolver));
  app.use(
    '/api/imap',
    initializeMiningRoutes(
      miningEngine,
      miningSources,
      authResolver,
      contacts,
      miningControllerDeps
    )
  );
  app.use(
    '/api',
    initializeContactsRoutes(contacts, authResolver, miningSourceService)
  );
  app.use('/api/enrich', initializeEnrichmentRoutes(authResolver));
  app.use(
    '/api',
    initializeSmtpSendersRoutes(smtpSenders, authResolver, miningSources)
  );

  if (ENV.SENTRY_DSN_BACKEND) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use(notFound);
  app.use(errorLogger);
  app.use(errorHandler);

  process.on('uncaughtException', (error) => {
    logger.error(
      '[UNCAUGHT EXCEPTION]:',
      util.inspect(error, { depth: null, colors: true })
    );
    // eslint-disable-next-line no-console
    console.error(error);

    if (ENV.SENTRY_DSN_BACKEND) {
      Sentry.captureException(error);
    }
  });

  return app;
}
