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
     * Calculate credit-related information based on the user's profile and specified units.
     *
     * @param userId - The unique identifier of the user.
     * @param units - The number of units (e.g., emails or contacts) for which to calculate credits.
     * @returns An object containing credit-related information:
     *   - `insufficientCredits`: Indicates whether the user has insufficient credits for the requested units.
     *   - `requestedUnits`: The number of units requested.
     *   - `availableUnits`: The available units (e.g., emails or contacts) based on the user's credits.
     * @throws Throws an error if user credits cannot be retrieved.
     */
    async validateCreditUsage(
      userId: string,
      units: number
    ): Promise<{
      insufficientCredits: boolean;
      requestedUnits: number;
      availableUnits: number;
    }> {
      const userCredits = (await USER_RESOLVER.getUserProfile(userId))?.credits;

      if (userCredits === undefined) {
        throw new Error('Failed to retrieve user credits.');
      }

      const insufficientCredits = userCredits < CREDITS_PER_UNIT;

      if (insufficientCredits) {
        return {
          insufficientCredits,
          requestedUnits: units,
          availableUnits: units
        };
      }

      const userCreditsToUnits = userCredits / CREDITS_PER_UNIT;
      const availableUnits =
        units > 0 && userCreditsToUnits >= units ? units : userCreditsToUnits;

      return {
        insufficientCredits,
        requestedUnits: units,
        availableUnits
      };
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
