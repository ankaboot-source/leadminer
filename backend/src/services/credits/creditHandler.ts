import { Users } from '../../db/interfaces/Users';

/**
 * Creates a credit verifier class that checks if a user has enough credits
 * to perform a certain action.
 */
export default class CreditsHandler {
  public readonly INSUFFICIENT_CREDITS_STATUS = 402;

  public readonly INSUFFICIENT_CREDITS_MESSAGE = 'Insufficient credits';

  constructor(
    private readonly userResolver: Users,
    private readonly creditsPerUnit: number
  ) {}

  /**
   * Calculate credit-related information based on the user's Account and specified units.
   *
   * @param userId - The unique identifier of the user.
   * @param units - The number of units (e.g., emails or contacts) for which to calculate credits.
   * @returns An object containing credit-related information:
   *   - `insufficientCredits`: Indicates whether the user has insufficient credits for the requested units.
   *   - `requestedUnits`: The number of units requested.
   *   - `availableUnits`: The available units (e.g., emails or contacts) based on the user's credits.
   * @throws Throws an error if user credits cannot be retrieved.
   */
  public async validate(
    userId: string,
    units: number
  ): Promise<{
    insufficientCredits: boolean;
    requestedUnits: number;
    availableUnits: number;
  }> {
    const userCredits = (await this.userResolver.getById(userId))?.credits;

    if (userCredits === undefined) {
      throw new Error('Failed to retrieve user credits.');
    }

    const insufficientCredits = userCredits < this.creditsPerUnit;

    if (insufficientCredits) {
      return {
        insufficientCredits,
        requestedUnits: units,
        availableUnits: 0
      };
    }

    const userCreditsToUnits = userCredits / this.creditsPerUnit;
    const availableUnits =
      units >= userCreditsToUnits ? userCreditsToUnits : units;

    return {
      insufficientCredits,
      requestedUnits: units,
      availableUnits
    };
  }

  /**
   * Deduct credits from a user's Account based on the number of units.
   *
   * @param userId - The user's ID.
   * @param units - The number of units (e.g., emails or contacts) to deduct credits for.
   * @returns - The updated user Account with deducted credits.
   * @throws - Throws an error if user credits cannot be retrieved or if credit deduction fails.
   */
  public async deduct(userId: string, units: number) {
    const userCredits = (await this.userResolver.getById(userId))?.credits;

    if (userCredits === undefined) {
      throw new Error('Failed to retrieve user credits.');
    }

    const deduction = userCredits - units * this.creditsPerUnit;
    const updatedUserAccount = await this.userResolver.update(userId, {
      credits: deduction >= 0 ? deduction : 0
    });

    if (!updatedUserAccount) {
      throw new Error('Failed to update user credits.');
    }

    return updatedUserAccount;
  }
}
