import { Router } from 'express';
import initializeAuthController from '../controllers/auth.controller';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';

export default function initializeAuthRoutes(authResolver: AuthResolver) {
  const router = Router();
  const middleware = initializeAuthMiddleware(authResolver);
  const { deleteUserAccount } = initializeAuthController(authResolver);

  router.delete('/users/delete', middleware, deleteUserAccount);

  return router;
}
