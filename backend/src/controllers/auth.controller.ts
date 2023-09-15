import { Request, Response, NextFunction } from 'express';
import { User } from '@supabase/supabase-js';
import { Users } from '../db/interfaces/Users';
import { customerHandler } from '../utils/credits';
import logger from '../utils/logger';

export default function initializeAuthController(userResolver: Users) {
  return {
    async deleteUserAccount(_: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as User;

      try {
        const deleteRelatedData = await userResolver.deleteUserData(user.id);

        if (!deleteRelatedData) {
          throw new Error(
            'Unexpected error when deleting mining data. Please try again later.'
          );
        }

        const userProfile = await userResolver.getById(user.id);

        if (userProfile?.stripe_customer_id) {
          try {
            await customerHandler().delete(userProfile.stripe_customer_id);
          } catch (err) {
            if (err instanceof Error) {
              logger.error(err.message);
            }
          }
        }

        const deleteUser = await userResolver.deleteUser(user.id);

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
