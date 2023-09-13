import { Router } from 'express';
import { Logger } from 'winston';
import initializeContactsController from '../controllers/contacts.controller';
import { Contacts } from '../db/interfaces/Contacts';
import { Users } from '../db/interfaces/Users';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import EmailStatusCache from '../services/cache/EmailStatusCache';
import { EmailStatusVerifier } from '../services/email-status/EmailStatusVerifier';

export default function initializeContactsRoutes(
  contacts: Contacts,
  userResolver: Users,
  authResolver: AuthResolver,
  emailStatusVerifier: EmailStatusVerifier,
  emailStatusCache: EmailStatusCache,
  logger: Logger
) {
  const router = Router();

  const { exportContactsCSV, verifyContacts, verifyExportContacts } =
    initializeContactsController(
      contacts,
      userResolver,
      emailStatusVerifier,
      emailStatusCache,
      logger
    );
  router.get(
    '/export/csv/verify',
    initializeAuthMiddleware(authResolver),
    verifyExportContacts
  );

  router.get(
    '/export/csv',
    initializeAuthMiddleware(authResolver),
    exportContactsCSV
  );

  router.post(
    '/contacts/verify',
    initializeAuthMiddleware(authResolver),
    verifyContacts
  );

  return router;
}
