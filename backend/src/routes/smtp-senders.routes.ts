import { Router } from 'express';
import initializeSmtpSendersController from '../controllers/smtp-senders.controller';
import { SmtpSenders } from '../db/interfaces/SmtpSenders';
import { MiningSources } from '../db/interfaces/MiningSources';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';

export default function initializeSmtpSendersRoutes(
  smtpSenders: SmtpSenders,
  authResolver: AuthResolver,
  miningSources?: MiningSources
) {
  const router = Router();
  const controller = initializeSmtpSendersController(
    smtpSenders,
    miningSources
  );
  const auth = initializeAuthMiddleware(authResolver);

  router.get('/smtp-senders', auth, controller.listSenders);
  router.post('/smtp-senders', auth, controller.createSender);
  router.post('/smtp-senders/autodetect', auth, controller.autodetect);
  router.post(
    '/smtp-senders/regenerate-from-sources',
    auth,
    controller.regenerateFromSources
  );
  router.get('/smtp-senders/:id', auth, controller.getSender);
  router.put('/smtp-senders/:id', auth, controller.updateSender);
  router.delete('/smtp-senders/:id', auth, controller.deleteSender);
  router.post('/smtp-senders/:id/test', auth, controller.testSender);

  return router;
}
