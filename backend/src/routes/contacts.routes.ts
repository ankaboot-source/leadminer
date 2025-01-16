import { Router } from 'express';
import initializeContactsController from '../controllers/contacts.controller';
import { Contacts } from '../db/interfaces/Contacts';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';

export default function initializeContactsRoutes(
  contacts: Contacts,
  authResolver: AuthResolver
) {
  const router = Router();

  const { exportContactsCSV, deleteContacts } =
    initializeContactsController(contacts);

  router.post(
    '/contacts/export/csv',
    initializeAuthMiddleware(authResolver),
    exportContactsCSV
  );

  router.delete(
    '/contacts',
    initializeAuthMiddleware(authResolver),
    deleteContacts
  );
  return router;
}
