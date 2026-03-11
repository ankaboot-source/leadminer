import { Context, Next } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("email-campaigns:bill");

interface BillingResult {
  success: boolean;
  chargedUnits?: number;
  error?: string;
}

interface SuccessResponse {
  msg: string;
  campaignId: string;
  queuedCount: number;
  chargedUnits?: number;
  billingError?: string;
}

/**
 * Charge campaign credits from user's account
 * Returns success status and details of the charge operation
 */
async function chargeCampaignCredits(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  createdCount: number,
  campaignId: string,
  isPartial: boolean,
): Promise<BillingResult> {
  try {
    const { data, error } = await supabaseAdmin.functions.invoke(
      "billing/campaign/charge",
      {
        body: {
          userId,
          units: createdCount,
          partialCampaign: isPartial,
        },
      },
    );

    if (error) {
      logger.error("Billing charge failed", {
        error: error.message,
        userId,
        campaignId,
        createdCount,
      });
      return { success: false, error: error.message };
    }

    logger.info("Billing charge successful", {
      userId,
      campaignId,
      createdCount,
      chargedUnits: data?.payload?.chargedUnits,
    });

    return {
      success: true,
      chargedUnits: data?.payload?.chargedUnits,
    };
  } catch (error) {
    logger.error("Billing charge exception", { error, userId, campaignId });
    return { success: false, error: String(error) };
  }
}

/**
 * Create success response object with optional billing information
 */
function createSuccessResponse(
  campaignId: string,
  queuedCount: number,
  billingResult?: BillingResult,
): SuccessResponse {
  const response: SuccessResponse = {
    msg: "Campaign queued",
    campaignId,
    queuedCount,
  };

  if (billingResult) {
    if (billingResult.success) {
      response.chargedUnits = billingResult.chargedUnits;
    } else {
      response.billingError = billingResult.error;
    }
  }

  return response;
}

export async function campaignBillMiddleware(c: Context, next: Next) {
  if (!c.req.path.endsWith("/campaigns/create")) {
    return next();
  }

  const campaignData = c.get("campaignCreate");
  if (!campaignData) {
    logger.error("No campaign data in context");
    return c.json(
      { error: "Campaign creation data missing", code: "INTERNAL_ERROR" },
      500,
    );
  }

  const { campaignId, createdCount, userId, payload } = campaignData;
  const billingEnabled = Deno.env.get("ENABLE_CREDIT") === "true";

  // If billing not enabled, just return success
  if (!billingEnabled) {
    return c.json(createSuccessResponse(campaignId, createdCount));
  }

  // Billing enabled - charge credits
  const supabaseAdmin = createSupabaseAdmin();
  const isPartial = payload?.partialCampaign === true;

  const billingResult = await chargeCampaignCredits(
    supabaseAdmin,
    userId,
    createdCount,
    campaignId,
    isPartial,
  );

  // Determine status code: 200 for success, 402 for failed charge
  const statusCode = billingResult.success ? 200 : 402;

  // Return response (campaign queued regardless of charge result)
  return c.json(
    createSuccessResponse(campaignId, createdCount, billingResult),
    statusCode as unknown as Parameters<typeof c.json>[1],
  );
}
