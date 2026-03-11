/**
 * Billing types shared across all billing operations
 */

export interface CreditValidationResult {
  hasDeficientCredits: boolean;
  hasInsufficientCredits: boolean;
  requestedUnits: number;
  availableUnits: number;
}

export interface ChargeCreditsInput {
  userId: string;
  units: number;
  feature: BillingFeature;
  partialAllowed?: boolean;
}

export interface QuotaCheckInput {
  userId: string;
  units: number;
  feature: BillingFeature;
}

export type BillingFeature = "campaign" | "export" | "enrichment";

export interface ChargeResult {
  status: 200 | 266 | 402;
  payload: {
    total: number;
    available: number;
    availableAlready?: number;
    chargedUnits?: number;
    partialCampaign?: boolean;
    reason?: string;
  };
}

export interface QuotaResult {
  hasCredits: boolean;
  availableUnits: number;
  requestedUnits: number;
}

export interface BillingError {
  error: string;
  code?: string;
}
