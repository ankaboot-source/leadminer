import { Context } from "hono";
import { checkQuota, chargeCredits } from "../shared/mod.ts";
import { createLogger } from "../../_shared/logger.ts";

const logger = createLogger("billing:campaign");

interface CampaignRequest {
  userId: string;
  units: number;
  partialCampaign?: boolean;
}

function validateCampaignRequest(payload: unknown): payload is CampaignRequest {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const { userId, units, partialCampaign } = payload as CampaignRequest;

  if (typeof userId !== "string" || !userId.trim()) {
    return false;
  }

  if (!Number.isInteger(units) || units <= 0) {
    return false;
  }

  return partialCampaign === undefined || typeof partialCampaign === "boolean";
}

/**
 * POST /billing/campaign/charge
 * Charge credits for campaign creation
 */
export async function handleCampaignCharge(c: Context): Promise<Response> {
  let payload: unknown;

  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON payload", code: "INVALID_JSON" }, 400);
  }

  if (!validateCampaignRequest(payload)) {
    return c.json(
      {
        error:
          "Invalid payload. Required: userId (string), units (positive integer). Optional: partialCampaign (boolean)",
        code: "INVALID_PAYLOAD",
      },
      400,
    );
  }

  const { userId, units, partialCampaign = false } = payload;

  logger.info("Processing campaign charge", { userId, units, partialCampaign });

  try {
    const result = await chargeCredits({
      userId,
      units,
      feature: "campaign",
      partialAllowed: partialCampaign,
    });

    logger.info("Campaign charge completed", {
      userId,
      status: result.status,
      chargedUnits: result.payload.chargedUnits,
    });

    return new Response(JSON.stringify(result.payload), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Campaign charge failed", { error, userId, units });
    return c.json(
      { error: "Billing service unavailable", code: "BILLING_ERROR" },
      500,
    );
  }
}

/**
 * POST /billing/campaign/quota
 * Check quota without charging credits
 */
export async function handleCampaignQuota(c: Context): Promise<Response> {
  let payload: unknown;

  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON payload", code: "INVALID_JSON" }, 400);
  }

  if (!validateCampaignRequest(payload)) {
    return c.json(
      {
        error:
          "Invalid payload. Required: userId (string), units (positive integer)",
        code: "INVALID_PAYLOAD",
      },
      400,
    );
  }

  const { userId, units } = payload;

  logger.info("Checking campaign quota", { userId, units });

  try {
    const result = await checkQuota({
      userId,
      units,
      feature: "campaign",
    });

    logger.info("Campaign quota check completed", {
      userId,
      hasCredits: result.hasCredits,
      availableUnits: result.availableUnits,
    });

    return c.json({
      hasCredits: result.hasCredits,
      available: result.availableUnits,
      requested: result.requestedUnits,
    });
  } catch (error) {
    logger.error("Campaign quota check failed", { error, userId, units });
    return c.json(
      { error: "Billing service unavailable", code: "BILLING_ERROR" },
      500,
    );
  }
}
