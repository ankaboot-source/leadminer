import { Context, Next } from "hono";
import { createLogger } from "../_shared/logger.ts";
import { getRegionFromTimezone } from "./utils/timezone-region.ts";
import { isValidPhoneNumber, normalizePhoneNumber } from "./utils/phone.ts";

const logger = createLogger("sms-campaigns:middleware");

export interface SmsPayload {
  selectedPhones?: string[];
  selectedRecipients?: { phone: string; personalization?: Record<string, unknown> }[];
  timezone?: string;
  [key: string]: unknown;
}

/**
 * Context shape stored under `campaignCheck` and consumed by the create
 * route handler. The commercial override replaces this file and keeps this
 * contract stable so the handler does not need to change.
 */
export interface CampaignCheckData {
  filteredPhones: string[];
  eligibleCount: number;
  userId: string;
  payload: Record<string, unknown>;
}

interface SuccessResponse {
  campaignId: string;
  recipientCount: number;
}

/**
 * Derive normalized, deduplicated, valid E.164 phone numbers from a payload.
 * Pure function so it can be unit-tested in isolation.
 */
export function resolveValidPhones(payload: SmsPayload): string[] {
  const phonesFromRecipients = (payload.selectedRecipients || []).map(
    (r) => r.phone,
  );
  const requestedPhones =
    phonesFromRecipients.length > 0 ? phonesFromRecipients : payload.selectedPhones || [];

  const region = getRegionFromTimezone(payload.timezone);
  const validPhones = requestedPhones
    .filter((phone) => isValidPhoneNumber(phone, region))
    .map((phone) => normalizePhoneNumber(phone, region) as string);

  return [...new Set(validPhones)];
}

/**
 * Validates the SMS campaign payload (recipient presence and phone validity)
 * and stores the filtered phone list in context. Billing-free by design —
 * the commercial repo replaces this file to inject credit checks.
 */
export async function complianceMiddleware(c: Context, next: Next) {
  if (!c.req.path.endsWith("/campaigns/create")) {
    return next();
  }

  let payload: SmsPayload;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON payload", code: "INVALID_JSON" }, 400);
  }

  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  const requestedPhones =
    (payload.selectedRecipients || []).length > 0
      ? (payload.selectedRecipients || []).map((r) => r.phone)
      : payload.selectedPhones || [];

  if (requestedPhones.length === 0) {
    return c.json({ error: "No recipients selected", code: "NO_RECIPIENTS" }, 400);
  }

  const filteredPhones = resolveValidPhones(payload);

  if (filteredPhones.length === 0) {
    return c.json(
      { error: "No valid phone numbers found", code: "NO_VALID_PHONES" },
      400,
    );
  }

  c.set("campaignCheck", {
    filteredPhones,
    eligibleCount: filteredPhones.length,
    userId: user.id,
    payload,
  });

  return await next();
}

/**
 * Final response middleware. Returns the campaignId + recipientCount that the
 * create handler stores in `campaignCreate` context. Commercial replaces this
 * to append `chargedUnits`/`billingError`.
 */
export async function createFinalResponseMiddleware(c: Context, next: Next) {
  if (!c.req.path.endsWith("/campaigns/create")) {
    return await next();
  }

  const campaignData = c.get("campaignCreate");
  if (!campaignData) {
    logger.error("No campaign data in context");
    return c.json(
      { error: "Campaign creation data missing", code: "INTERNAL_ERROR" },
      500,
    );
  }

  const { campaignId, createdCount } = campaignData;
  const response: SuccessResponse = {
    campaignId,
    recipientCount: createdCount,
  };

  return c.json(response);
}
