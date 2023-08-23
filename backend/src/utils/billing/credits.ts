import { Users } from '../../db/interfaces/Users';

/**
 * Get the user's credits from the authentication resolver.
 *
 * @param userId - User ID.
 * @param userResolver - An authentication resolver object.
 * @returns {Promise<number>} - The user's credits.
 * @throws {Error} - Throws an error if fetching credits fails.
 */
async function getUserCredits(
  userId: string,
  userResolver: Users
): Promise<number> {
  const profile = await userResolver.getUserProfile(userId);
  const credits = profile?.credits;

  if (credits === undefined) {
    throw new Error('Failed to get user credits.');
  }

  return credits;
}

/**
 * Deduct credits from the user's account.
 *
 * @param userId - User ID.
 * @param credits - The amount of credits to set.
 * @param userResolver - An authentication resolver object.
 * @returns Returns true if credit deduction is succesfull, Otherwise false.
 * @throws {Error} - Throws an error if updating credits fails.
 */
async function setUserCredits(
  userId: string,
  credits: number,
  userResolver: Users
): Promise<boolean> {
  const updatedCredit = await userResolver.updateUserProfile(userId, {
    credits
  });

  if (!updatedCredit) {
    throw new Error('Failed to update credits.');
  }

  return updatedCredit;
}

/**
 * Calculate the quota required for the action based on units and credits per unit.
 *
 * @param units - The number of emails or contacts.
 * @param creditsPerUnit - The number of credits required per contact or email.
 * @returns The calculated quota.
 */
function calculateQuota(units: number, creditsPerUnit: number): number {
  return units * creditsPerUnit;
}

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
      const credits = await getUserCredits(userId, userResolver);
      const calculatedQuota = calculateQuota(units, CREDITS_PER_UNIT);

      if (credits < calculatedQuota) {
        return false;
      }

      const remainingCredit = credits - calculatedQuota;
      return setUserCredits(userId, remainingCredit, userResolver);
    }
  };
}

export const INSUFFICIENT_CREDITS_STATUS = 402;
export const INSUFFICIENT_CREDITS_MESSAGE = 'Insufficient credits';
