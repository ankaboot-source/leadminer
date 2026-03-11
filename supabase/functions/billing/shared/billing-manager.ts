import { createSupabaseAdmin } from "../../_shared/supabase.ts";
import {
  ChargeCreditsInput,
  ChargeResult,
  QuotaCheckInput,
  QuotaResult,
  CreditValidationResult,
} from "./types.ts";

/**
 * Billing Manager - Handles credit validation and charging
 *
 * This is a shared module that can be used by all billing endpoints.
 * It mirrors the backend billing plugin functionality for edge functions.
 * Provides a clean interface for:
 * - Checking user credit quotas (validate only)
 * - Charging credits for operations
 * - Handling partial credit scenarios
 */

async function getUserCredits(userId: string): Promise<number> {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .schema("private")
    .from("profiles")
    .select("credits")
    .eq("user_id", userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch user credits: ${error.message}`);
  }

  return data?.credits ?? 0;
}

async function deductCredits(userId: string, units: number): Promise<void> {
  const supabase = createSupabaseAdmin();

  // Get current credits first
  const currentCredits = await getUserCredits(userId);
  const newCredits = Math.max(0, currentCredits - units);

  const { error } = await supabase
    .schema("private")
    .from("profiles")
    .update({ credits: newCredits })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to deduct credits: ${error.message}`);
  }
}

function validateCredits(
  available: number,
  requested: number,
): CreditValidationResult {
  const hasDeficientCredits = available === 0;
  const hasInsufficientCredits = available < requested;

  return {
    hasDeficientCredits,
    hasInsufficientCredits,
    requestedUnits: requested,
    availableUnits: available,
  };
}

/**
 * Check quota without charging - validates if user has sufficient credits
 */
export async function checkQuota(input: QuotaCheckInput): Promise<QuotaResult> {
    const availableCredits = await getUserCredits(input.userId);

    return {
      hasCredits: availableCredits >= input.units,
      availableUnits: availableCredits,
      requestedUnits: input.units,
    };
  }

/**
 * Charge credits for an operation
 * Handles partial charging if partialAllowed is true
 */
export async function chargeCredits(input: ChargeCreditsInput): Promise<ChargeResult> {
    const availableCredits = await getUserCredits(input.userId);
    const validation = validateCredits(availableCredits, input.units);

    // No credits at all
    if (validation.hasDeficientCredits) {
      return {
        status: 402,
        payload: {
          total: input.units,
          available: 0,
          availableAlready: 0,
          reason: "credits",
        },
      };
    }

    // Insufficient credits
    if (validation.hasInsufficientCredits) {
      // If partial is allowed, charge what we can
      if (input.partialAllowed) {
        const chargedUnits = Math.floor(validation.availableUnits);
        await deductCredits(input.userId, chargedUnits);

        return {
          status: 266,
          payload: {
            total: input.units,
            available: chargedUnits,
            availableAlready: 0,
            chargedUnits,
            partialCampaign: true,
            reason: "credits",
          },
        };
      }

      // Partial not allowed - return 266 for user confirmation
      return {
        status: 266,
        payload: {
          total: input.units,
          available: Math.floor(validation.availableUnits),
          availableAlready: 0,
          reason: "credits",
        },
      };
    }

    // Sufficient credits - charge full amount
    await deductCredits(input.userId, input.units);

    return {
      status: 200,
      payload: {
        total: input.units,
        available: input.units,
        availableAlready: 0,
        chargedUnits: input.units,
        partialCampaign: false,
      },
    };
  }

/**
 * Delete customer billing data - for future use in account deletion
 * Note: This is a placeholder for when we migrate account deletion to edge functions
 */
export function deleteCustomer(userId: string): void {
  // TODO: Implement billing cleanup when migrating account deletion to edge functions
  // This mirrors Billing.deleteCustomer from backend
  console.log(`Billing cleanup for user ${userId} - implement when needed`);
}
