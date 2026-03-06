import { Context, Next } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("email-campaigns:bill");

export async function campaignBillMiddleware(c: Context, next: Next) {
  if (!c.req.path.endsWith("/campaigns/create")) {
    return next();
  }

  const billingEnabled = Deno.env.get("ENABLE_BILLING") === "true";

  const campaignData = c.get("campaignCreate");
  if (!campaignData) {
    logger.error("No campaign data in context");
    return c.json(
      { error: "Campaign creation data missing", code: "INTERNAL_ERROR" },
      500,
    );
  }

  const { campaignId, createdCount, userId } = campaignData;

  if (!billingEnabled) {
    return c.json({
      msg: "Campaign queued",
      campaignId,
      queuedCount: createdCount,
    });
  }

  try {
    const supabaseAdmin = createSupabaseAdmin();

    const { data, error } = await supabaseAdmin.functions.invoke(
      "billing/campaign/charge",
      {
        body: {
          userId,
          units: createdCount,
          partialCampaign: false,
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
    } else {
      logger.info("Billing charge successful", {
        userId,
        campaignId,
        createdCount,
        chargedUnits: data?.payload?.chargedUnits,
      });
    }

    return c.json({
      msg: "Campaign queued",
      campaignId,
      queuedCount: createdCount,
    });
  } catch (error) {
    logger.error("Billing charge exception", { error, userId, campaignId });
    return c.json({
      msg: "Campaign queued",
      campaignId,
      queuedCount: createdCount,
    });
  }
}
