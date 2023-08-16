import { Request, Response, NextFunction } from 'express';
import { User } from '@supabase/supabase-js';
import AuthResolver from '../services/auth/AuthResolver';

export default function initializeAuthController(authResolver: AuthResolver) {
  return {
    async deleteUserAccount(_: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;

      try {
        const deleteRelatedData = await authResolver.deleteUserData(user.id);

        if (!deleteRelatedData) {
          throw new Error(
            'Unexpected error when deleting mining data. Please try again later.'
          );
        }

        const deleteUser = await authResolver.deleteUser(user.id);

        if (!deleteUser) {
          throw new Error(
            'Unexpected error when deleting user. Please try again later.'
          );
        }

        return res.status(200).json({
          message: 'Successfully deleted user'
        });
      } catch (error) {
        return next(error);
      }
    }
  };
}
