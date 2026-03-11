import { Context, Next } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { initI18n, t, getUserLocale } from "./i18n.ts";

const logger = createLogger("email-campaigns:check");

// Constants
const PRIVACY_POLICY_URL = "/privacy-policy";
const DEFAULT_BILLING_URL = "/billing";

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
  };
  buttons: ModalButton[];
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
 * Check compliance - verifies consent status of contacts
 * Returns ModalResponse if there are consent issues, null if all contacts have consent
 */
function checkCompliance(
  contacts: ContactSnapshot[],
  selectedEmails: string[],
): ModalResponse | null {
  const consentedContacts = contacts.filter(
    (c) => c.consent_status !== "opt_out",
  );
  const total = selectedEmails.length;

  // Scenario: No contacts have consent
  if (consentedContacts.length === 0) {
    return {
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
    };
  }

  // Scenario: Partial consent (some contacts opted out)
  if (consentedContacts.length < selectedEmails.length) {
    return {
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
    };
  }

  // All contacts have consent
  return null;
}

/**
 * Check billing - verifies credits/quota availability
 * Returns ModalResponse if there are credit issues, null if enough credits
 */
async function checkBilling(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  consentedContacts: ContactSnapshot[],
  userId: string,
  billingUrl: string,
): Promise<ModalResponse | null> {
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
    };
  }

  // Partial credits
  const eligibleCount = Math.min(consentedContacts.length, data.available);
  if (eligibleCount < consentedContacts.length) {
    return {
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
    };
  }

  // Enough credits
  return null;
}

export async function campaignCheckMiddleware(c: Context, next: Next) {
  if (!c.req.path.endsWith("/campaigns/create")) {
    return next();
  }

  let payload: {
    selectedEmails?: string[];
    partialCampaign?: boolean;
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

  const locale = "fr"; //getUserLocale(user.user_metadata || {});
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
    const complianceResult = checkCompliance(contacts, selectedEmails);
    if (complianceResult) {
      const statusCode = complianceResult.data?.available === 0 ? 400 : 266;
      return c.json(
        complianceResult,
        statusCode as unknown as Parameters<typeof c.json>[1],
      );
    }

    // All contacts have consent
    const consentedContacts = contacts.filter(
      (c) => c.consent_status !== "opt_out",
    );

    // Check 2: Billing (credits) - only if enabled
    const billingEnabled = Deno.env.get("ENABLE_CREDIT") === "true";
    if (billingEnabled) {
      const billingUrl = Deno.env.get("BILLING_URL") || DEFAULT_BILLING_URL;
      const billingResult = await checkBilling(
        supabaseAdmin,
        consentedContacts,
        user.id,
        billingUrl,
      );
      if (billingResult) {
        const statusCode = billingResult.data?.available === 0 ? 402 : 266;
        return c.json(
          billingResult,
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
