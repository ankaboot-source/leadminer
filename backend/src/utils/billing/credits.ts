import { Users } from '../../db/interfaces/Users';

/**
 * Creates a credit verifier function that checks if a user has enough credits
 * to perform a certain action.
 *
 * @param enable - Whether to enabled/disable verification.
 * @param creditsPerUnit - The number of credits required per contact or email.
 * @param userResolver - Authentication resolver.
 * @returns - Verification function or undefined.
 */
export function createCreditHandler(
  enable: boolean,
  creditsPerUnit: number | undefined
) {
  if (!enable || !creditsPerUnit) {
    return undefined;
  }

  const CREDITS_PER_UNIT = creditsPerUnit;

  return {
    /**
     * Verifies if the user has enough credits to perform an action,
     * calculates a quota, and deducts the credits if successful.
     *
     * @param userId - User ID.
     * @param userResolver - An authentication resolver object.
     * @param units - The number of emails or contacts.
     * @returns {Promise<boolean>} - Returns true if credits verification, deduction is succesfull, otherwise false.
     */
    async process(
      userId: string,
      units: number,
      userResolver: Users
    ): Promise<boolean> {
      const credits = (await userResolver.getUserProfile(userId))?.credits;

      if (!credits) {
        throw new Error('Failed to get user credits');
      }

      const calculatedQuota = units * CREDITS_PER_UNIT;

      if (credits < calculatedQuota) {
        return false;
      }

      const updatedCredit = await userResolver.updateUserProfile(userId, {
        credits: credits - calculatedQuota
      });

      if (!updatedCredit) {
        throw new Error('Failed to update credits.');
      }

      return updatedCredit;
    }
  };
}

export const INSUFFICIENT_CREDITS_STATUS = 402;
export const INSUFFICIENT_CREDITS_MESSAGE = 'Insufficient credits';
