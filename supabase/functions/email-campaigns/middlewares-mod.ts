import { Context, Next } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { initI18n, t, getUserLocale } from "./i18n.ts";

// Constants
const PRIVACY_POLICY_URL = "/privacy-policy";
const DEFAULT_BILLING_URL = "/billing";

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

interface ContactSnapshot {
  email: string;
  consent_status: "legitimate_interest" | "opt_out" | "opt_in";
}

interface ModalButton {
  title: string;
  link?: string;
  action?: string;
  severity?: "primary" | "secondary" | "contrast";
  variant?: "outlined" | "text" | "link";
  icon?: string;
}

interface ModalResponse {
  type: "modal";
  title: string;
  description: string;
  data: {
    total: number;
    available: number;
    availableAlready: number;
    reason?: string;
    partial_continue?: "partial_one" | "partial_two";
  };
  buttons: ModalButton[];
}

interface CheckResult {
  response: ModalResponse | null;
  partialField?: "partial_one" | "partial_two";
}

async function getSelectedContacts(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  emails: string[],
): Promise<ContactSnapshot[]> {
  const { data, error } = await supabaseAdmin
    .schema("private")
    .from("refinedpersons")
    .select("email, consent_status")
    .eq("user_id", userId)
    .in("email", emails);

  if (error) {
    throw new Error(`Failed to fetch contacts: ${error.message}`);
  }

  return (data || []).map((row) => ({
    email: row.email,
    consent_status: row.consent_status || "legitimate_interest",
  }));
}

/**
 * Check billing - verifies credits/quota availability
 * Returns CheckResult with response and partial field if applicable
 */
async function checkBilling(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  consentedContacts: ContactSnapshot[],
  userId: string,
  billingUrl: string,
  _partialOne: boolean, // Ignored - for consistency
  partialTwo: boolean,
): Promise<CheckResult> {
  const { data, error } = await supabaseAdmin.functions.invoke(
    "billing/campaign/quota",
    {
      body: {
        userId,
        units: consentedContacts.length,
      },
    },
  );

  if (error) {
    logger.error("Billing quota check failed", {
      error: error.message,
      userId,
    });
    throw new Error("Billing service unavailable");
  }

  const total = consentedContacts.length;

  // No credits at all
  if (!data?.hasCredits && !data?.available) {
    return {
      response: {
        type: "modal",
        title: t("modal.insufficient_credits.title"),
        description: t("modal.insufficient_credits.description", {
          count: total,
          actionType: t("modal.insufficient_credits.action_types.campaign"),
          engagementType: t(
            "modal.insufficient_credits.engagement_types.contact",
            { count: total },
          ),
          formattedTotal: total,
        }),
        data: { total, available: 0, availableAlready: 0, reason: "credits" },
        buttons: [
          {
            title: t("modal.insufficient_credits.buttons.upgrade"),
            link: billingUrl,
            severity: "contrast",
            icon: "mdiRocketLaunch",
          },
        ],
      },
      partialField: undefined,
    };
  }

  // Partial credits
  const eligibleCount = Math.min(consentedContacts.length, data.available);
  if (eligibleCount < consentedContacts.length && !partialTwo) {
    return {
      response: {
        type: "modal",
        title: t("modal.insufficient_credits.title"),
        description: t("modal.insufficient_credits.description", {
          count: total,
          actionType: t("modal.insufficient_credits.action_types.campaign"),
          engagementType: t(
            "modal.insufficient_credits.engagement_types.contact",
            { count: total },
          ),
          formattedTotal: total,
        }),
        data: {
          total: consentedContacts.length,
          available: eligibleCount,
          availableAlready: 0,
          reason: "credits",
        },
        buttons: [
          {
            title: t("modal.insufficient_credits.buttons.continue_partial", {
              count: eligibleCount,
              available: eligibleCount,
              engagementType: t(
                "modal.insufficient_credits.engagement_types.contact",
                { count: eligibleCount },
              ),
            }),
            action: "continue_partial",
            variant: "outlined",
          },
          {
            title: t("modal.insufficient_credits.buttons.upgrade"),
            link: billingUrl,
            severity: "contrast",
            icon: "mdiRocketLaunch",
          },
        ],
      },
      partialField: "partial_two",
    };
  }

  // Enough credits (or partial already acknowledged)
  return { response: null, partialField: undefined };
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
): Promise<BillingResult> {
  try {
    const { data, error } = await supabaseAdmin.functions.invoke(
      "billing/campaign/charge",
      {
        body: {
          userId,
          units: createdCount,
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
 * Check compliance - verifies consent status of contacts
 * Returns CheckResult with response and partial field if applicable
 */
function checkCompliance(
  contacts: ContactSnapshot[],
  selectedEmails: string[],
  partialOne: boolean,
  _partialTwo: boolean, // Ignored - for consistency
): CheckResult {
  const consentedContacts = contacts.filter(
    (c) => c.consent_status !== "opt_out",
  );
  const total = selectedEmails.length;

  // Scenario: No contacts have consent
  if (consentedContacts.length === 0) {
    return {
      response: {
        type: "modal",
        title: t("modal.no_consented_contacts.title"),
        description: t("modal.no_consented_contacts.description", {
          count: total,
          total,
          engagementType: t(
            "modal.no_consented_contacts.engagement_types.contact_plural",
          ),
        }),
        data: { total, available: 0, availableAlready: 0, reason: "consent" },
        buttons: [
          {
            title: t("modal.no_consented_contacts.buttons.privacy_policy"),
            link: PRIVACY_POLICY_URL,
            variant: "link",
          },
        ],
      },
      partialField: undefined,
    };
  }

  // Scenario: Partial consent (some contacts opted out) and not acknowledged
  if (consentedContacts.length < selectedEmails.length && !partialOne) {
    return {
      response: {
        type: "modal",
        title: t("modal.consent_required.title"),
        description: t("modal.consent_required.description", {
          available: consentedContacts.length,
          total,
          engagementType: t(
            "modal.consent_required.engagement_types.contact_plural",
          ),
        }),
        data: {
          total: selectedEmails.length,
          available: consentedContacts.length,
          availableAlready: 0,
          reason: "consent",
        },
        buttons: [
          {
            title: t("modal.consent_required.buttons.privacy_policy"),
            link: PRIVACY_POLICY_URL,
            variant: "link",
          },
          {
            title: t("modal.consent_required.buttons.continue_partial", {
              count: consentedContacts.length,
              engagementType: t(
                "modal.consent_required.engagement_types.contact",
                { count: consentedContacts.length },
              ),
            }),
            action: "continue_partial",
            severity: "primary",
          },
        ],
      },
      partialField: "partial_one",
    };
  }

  // All contacts have consent (or partial already acknowledged)
  return { response: null, partialField: undefined };
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

export async function createFinalResponseMiddleware(c: Context, next: Next) {
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

  const { campaignId, createdCount, userId } = campaignData;
  const billingEnabled = Deno.env.get("ENABLE_CREDIT") === "true";

  // If billing not enabled, just return success
  if (!billingEnabled) {
    return c.json(createSuccessResponse(campaignId, createdCount));
  }

  // Billing enabled - charge credits (limits already enforced by complianceMiddleware)
  const supabaseAdmin = createSupabaseAdmin();

  const billingResult = await chargeCampaignCredits(
    supabaseAdmin,
    userId,
    createdCount,
    campaignId,
  );

  // Determine status code: 200 for success, 402 for failed charge
  const statusCode = billingResult.success ? 200 : 402;

  // Return response (campaign queued regardless of charge result)
  return c.json(
    createSuccessResponse(campaignId, createdCount, billingResult),
    statusCode as unknown as Parameters<typeof c.json>[1],
  );
}

export async function complianceMiddleware(c: Context, next: Next) {
  if (!c.req.path.endsWith("/campaigns/create")) {
    return next();
  }

  let payload: {
    selectedEmails?: string[];
    partial_one?: boolean;
    partial_two?: boolean;
    [key: string]: unknown;
  };

  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON payload", code: "INVALID_JSON" }, 400);
  }

  const selectedEmails = payload.selectedEmails || [];

  if (selectedEmails.length === 0) {
    return c.json({ error: "No contacts selected", code: "NO_CONTACTS" }, 400);
  }

  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  const locale = getUserLocale(user.user_metadata || {});
  await initI18n(locale);

  const supabaseAdmin = createSupabaseAdmin();

  try {
    // Fetch all contacts first
    const contacts = await getSelectedContacts(
      supabaseAdmin,
      user.id,
      selectedEmails,
    );

    // Check 1: Compliance (consent) - ALWAYS FIRST
    const complianceCheck = checkCompliance(
      contacts,
      selectedEmails,
      payload.partial_one || false,
      payload.partial_two || false,
    );

    if (complianceCheck.response) {
      const statusCode =
        complianceCheck.response.data?.available === 0 ? 400 : 266;

      // Add partial_continue field if applicable
      if (complianceCheck.partialField) {
        complianceCheck.response.data.partial_continue =
          complianceCheck.partialField;
      }

      return c.json(
        complianceCheck.response,
        statusCode as unknown as Parameters<typeof c.json>[1],
      );
    }

    // All contacts have consent
    const consentedContacts = contacts.filter(
      (c) => c.consent_status !== "opt_out",
    );

    // Check 2: Billing (credits) - only if enabled
    if (Deno.env.get("ENABLE_CREDIT") === "true") {
      const billingCheck = await checkBilling(
        supabaseAdmin,
        consentedContacts,
        user.id,
        DEFAULT_BILLING_URL,
        payload.partial_one || false,
        payload.partial_two || false,
      );

      if (billingCheck.response) {
        const statusCode =
          billingCheck.response.data?.available === 0 ? 402 : 266;

        // Add partial_continue field if applicable
        if (billingCheck.partialField) {
          billingCheck.response.data.partial_continue =
            billingCheck.partialField;
        }

        return c.json(
          billingCheck.response,
          statusCode as unknown as Parameters<typeof c.json>[1],
        );
      }
    }

    // All checks passed - proceed with campaign
    const finalEmails = consentedContacts.map((c) => c.email);

    c.set("campaignCheck", {
      filteredEmails: finalEmails,
      eligibleCount: finalEmails.length,
      userId: user.id,
      payload,
    });

    return await next();
  } catch (error) {
    logger.error("Campaign check failed", { error, userId: user.id });
    return c.json(
      {
        error: "Failed to validate campaign constraints",
        code: "CHECK_FAILED",
      },
      500,
    );
  }
}
