import { Router } from 'express';
import initializeContactsController from '../controllers/contacts.controller';
import initializeContactsVerificationController from '../controllers/contacts-verification.controller';
import { Contacts } from '../db/interfaces/Contacts';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';
import { MiningSources } from '../db/interfaces/MiningSources';

export default function initializeContactsRoutes(
  contacts: Contacts,
  authResolver: AuthResolver,
  miningSources: MiningSources
) {
  const router = Router();

  const { exportContactsCSV } = initializeContactsController(
    contacts,
    miningSources
  );

  const { verifyEmailStatus } =
    initializeContactsVerificationController(contacts);

  router.post(
    '/contacts/export/:exportType',
    initializeAuthMiddleware(authResolver),
    exportContactsCSV
  );

  router.post(
    '/contacts/verify',
    initializeAuthMiddleware(authResolver),
    verifyEmailStatus
  );

  return router;
}
