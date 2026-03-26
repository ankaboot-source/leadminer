import { Context, Next } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { initI18n, t, getUserLocale } from "./i18n.ts";

// Constants
const PRIVACY_POLICY_URL = "/privacy-policy";

const logger = createLogger("email-campaigns:middleware");

interface SuccessResponse {
  msg: string;
  campaignId: string;
  queuedCount: number;
  chargedUnits?: number;
}

interface ContactSnapshot {
  email: string;
  consent_status: "legitimate_interest" | "opt_out" | "opt_in";
  updated_at: string;
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
  eligibleCount?: number;
}

async function getSelectedContacts(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  emails: string[],
): Promise<ContactSnapshot[]> {
  const { data, error } = await supabaseAdmin
    .schema("private")
    .from("persons")
    .select("email, consent_status, updated_at")
    .eq("user_id", userId)
    .in("email", emails)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch contacts: ${error.message}`);
  }

  const contactsByEmail = new Map<string, ContactSnapshot>();

  for (const row of data || []) {
    const key = row.email.toLowerCase();
    if (contactsByEmail.has(key)) continue;

    contactsByEmail.set(key, {
      email: row.email,
      consent_status: row.consent_status || "legitimate_interest",
      updated_at: row.updated_at,
    });
  }

  return [...contactsByEmail.values()];
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
            "modal.no_consented_contacts.engagement_types.contact",
            { count: total },
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
          engagementType: t("modal.consent_required.engagement_types.contact", {
            count: total,
          }),
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
): SuccessResponse {
  const response: SuccessResponse = {
    msg: "Campaign queued",
    campaignId,
    queuedCount,
  };

  return response;
}

export function createFinalResponseMiddleware(c: Context, next: Next) {
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

  const { campaignId, createdCount } = campaignData;
  return c.json(createSuccessResponse(campaignId, createdCount));
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

    const consentedContacts = contacts.filter(
      (c) => c.consent_status !== "opt_out",
    );
    const eligibleCount = consentedContacts.length;
    const finalContacts = consentedContacts.slice(0, eligibleCount);
    const finalEmails = finalContacts.map((c) => c.email);

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
