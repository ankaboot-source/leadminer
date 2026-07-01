import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import initializeContactsVerificationController from '../controllers/contacts-verification.controller';
import { Contacts } from '../db/interfaces/Contacts';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';

export default function initializeContactsRoutes(
  contacts: Contacts,
  authResolver: AuthResolver
) {
  const router = Router();
  const contactsRouteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
  });

  const { verifyEmailStatus } =
    initializeContactsVerificationController(contacts);

  router.post(
    '/contacts/verify',
    initializeAuthMiddleware(authResolver),
    contactsRouteLimiter,
    verifyEmailStatus
  );

  return router;
}
