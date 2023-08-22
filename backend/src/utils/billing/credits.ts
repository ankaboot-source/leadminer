import { Response } from 'express';
import AuthResolver from '../../services/auth/AuthResolver';

/**
 * Creates a credit verifier function that checks if a user has enough credits
 * to perform a certain action.
 *
 * @param enableVerifier - Whether to enabled/disable verification.
 * @param creditsPerUnit - The number of credits required per contact or email.
 * @param authResolver - Authentication resolver.
 * @returns - Verification function or undefined.
 */
export default function createCreditVerifier(
  enableVerifier: boolean,
  creditsPerUnit: number
) {
  if (!enableVerifier) {
    return undefined;
  }

  return {
    /**
     * Verifies if the user has enough credits to perform an action,
     * calculates a quota, and deducts the credits if successful.
     *
     * @param req - Express.js request object.
     * @param res - Express.js response object.
     * @param units - The nuumber of emails or contacts.
     * @throws {Error} - Throws an error if the credit deduction fails.
     */
    async verifyThenDeduct(
      res: Response,
      authResolver: AuthResolver,
      units: number
    ) {
      const CREDITS_PER_UNIT = creditsPerUnit;
      const PAYMENT_REQUIRED_STATUS_CODE = 402;

      const { user } = res.locals;

      const { credits } = (await authResolver.getProfile(user.id)) ?? {};

      if (credits === undefined) {
        return null;
      }

      const calculatedQuota = units * CREDITS_PER_UNIT;
      const hasAvailableCredits = credits >= calculatedQuota;
      const remainingCredits = hasAvailableCredits && credits - calculatedQuota;

      if (!hasAvailableCredits) {
        return res
          .status(PAYMENT_REQUIRED_STATUS_CODE)
          .json({ message: 'Payment required' });
      }

      const updatedCredit = await authResolver.updateProfile(user.id, {
        credits: remainingCredits // deduct credits from the user.
      });

      if (!updatedCredit) {
        throw new Error('Failed to update user credits.');
      }

      return null;
    }
  };
}
