import { Router } from 'express';
import initializeContactsController from '../controllers/contacts.controller';
import { Contacts } from '../db/interfaces/Contacts';
import { Users } from '../db/interfaces/Users';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';

export default function initializeContactsRoutes(
  contacts: Contacts,
  userResolver: Users,
  authResolver: AuthResolver
) {
  const router = Router();

  const { exportContactsCSV, verifyExportContacts } =
    initializeContactsController(contacts, userResolver);
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

  return router;
}
