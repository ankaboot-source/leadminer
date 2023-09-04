import { Router } from 'express';
import { Users } from '../db/interfaces/Users';
import initializeAuthController from '../controllers/auth.controller';
import initializeAuthMiddleware from '../middleware/auth';
import AuthResolver from '../services/auth/AuthResolver';

export default function initializeAuthRoutes(
  authResolver: AuthResolver,
  userResolver: Users
) {
  const router = Router();
  const middleware = initializeAuthMiddleware(authResolver);
  const { deleteUserAccount } = initializeAuthController(userResolver);

  router.delete('/users', middleware, deleteUserAccount);

  return router;
}
