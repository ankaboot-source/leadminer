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
  creditsPerUnit: number | undefined,
  userResolver: Users
) {
  if (!enable || !creditsPerUnit) {
    return undefined;
  }

  const USER_RESOLVER = userResolver;
  const CREDITS_PER_UNIT = creditsPerUnit;

  return {
    /**
     * Calculate the available credits for a user based on their profile and the specified units.
     *
     * @param userId - The user's ID.
     * @param units - The number of units (e.g., emails or contacts) for which to calculate credits.
     * @returns - The available credits, capped at the specified units.
     * @throws - Throws an error if user credits cannot be retrieved.
     */
    async calculateAvailableUnitsFromCredits(
      userId: string,
      units: number
    ): Promise<number> {
      const userCredits = (await USER_RESOLVER.getUserProfile(userId))?.credits;

      if (userCredits === undefined) {
        throw new Error('Failed to retrieve user credits.');
      }

      const availableCredits = userCredits / CREDITS_PER_UNIT;
      return availableCredits > units ? units : availableCredits;
    },

    /**
     * Deduct credits from a user's profile based on number of units.
     *
     * @param userId - The user's ID.
     * @param units - The number of units (e.g., emails or contacts) to deduct credits for.
     * @returns - The updated user profile with deducted credits.
     * @throws - Throws an error if user credits cannot be retrieved or if credit deduction fails.
     */
    async deductCredits(userId: string, units: number) {
      const userCredits = (await USER_RESOLVER.getUserProfile(userId))?.credits;

      if (userCredits === undefined) {
        throw new Error('Failed to retrieve user credits.');
      }

      const deduction = userCredits - units * CREDITS_PER_UNIT;
      const updatedUserProfile = await USER_RESOLVER.updateUserProfile(userId, {
        credits: deduction >= 0 ? deduction : 0
      });

      if (!updatedUserProfile) {
        throw new Error('Failed to update user credits.');
      }

      return updatedUserProfile;
    }
  };
}

export const INSUFFICIENT_CREDITS_STATUS = 402;
export const INSUFFICIENT_CREDITS_MESSAGE = 'Insufficient credits';
