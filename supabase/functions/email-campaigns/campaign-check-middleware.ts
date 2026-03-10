import { Context, Next } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { t, getUserLocale } from "./i18n.ts";

const logger = createLogger("email-campaigns:check");

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

function buildModalResponse(
  locale: "en" | "fr",
  scenario:
    | "insufficient_credits"
    | "consent_required"
    | "partial_credits"
    | "no_consented_contacts",
  total: number,
  available: number,
  availableAlready: number,
  billingUrl?: string,
): ModalResponse {
  const values = { total, available, availableAlready };

  const buttons: ModalButton[] = [];

  if (scenario === "insufficient_credits") {
    if (billingUrl) {
      buttons.push({
        title: t(locale, "modal.insufficient_credits.buttons.upgrade"),
        link: billingUrl,
        severity: "contrast",
      });
    }
    if (available > 0) {
      buttons.push({
        title: t(
          locale,
          "modal.insufficient_credits.buttons.continue_partial",
          values,
        ),
        action: "continue_partial",
        variant: "outlined",
      });
    }
    buttons.push({
      title: t(locale, "modal.insufficient_credits.buttons.cancel"),
      action: "cancel",
      severity: "secondary",
      variant: "text",
    });

    return {
      type: "modal",
      title: t(locale, "modal.insufficient_credits.title"),
      description: t(locale, "modal.insufficient_credits.description", values),
      data: { total, available, availableAlready, reason: "credits" },
      buttons,
    };
  }

  if (scenario === "partial_credits") {
    if (billingUrl) {
      buttons.push({
        title: t(locale, "modal.partial_credits.buttons.upgrade"),
        link: billingUrl,
        severity: "contrast",
      });
    }
    buttons.push({
      title: t(
        locale,
        "modal.partial_credits.buttons.continue_partial",
        values,
      ),
      action: "continue_partial",
      variant: "outlined",
    });
    buttons.push({
      title: t(locale, "modal.partial_credits.buttons.cancel"),
      action: "cancel",
      severity: "secondary",
      variant: "text",
    });

    return {
      type: "modal",
      title: t(locale, "modal.partial_credits.title"),
      description: t(locale, "modal.partial_credits.description", values),
      data: { total, available, availableAlready, reason: "credits" },
      buttons,
    };
  }

  if (scenario === "no_consented_contacts") {
    buttons.push({
      title: t(locale, "modal.no_consented_contacts.buttons.cancel"),
      action: "cancel",
      severity: "secondary",
      variant: "text",
    });
    buttons.push({
      title: t(locale, "modal.no_consented_contacts.buttons.privacy_policy"),
      link: "/privacy-policy",
      variant: "link",
    });

    return {
      type: "modal",
      title: t(locale, "modal.no_consented_contacts.title"),
      description: t(locale, "modal.no_consented_contacts.description", {
        total,
      }),
      data: { total, available: 0, availableAlready: 0, reason: "consent" },
      buttons,
    };
  }

  // consent_required
  buttons.push({
    title: t(locale, "modal.consent_required.buttons.privacy_policy"),
    link: "/privacy-policy",
    variant: "link",
  });
  if (available > 0) {
    buttons.push({
      title: t(
        locale,
        "modal.consent_required.buttons.continue_partial",
        values,
      ),
      action: "continue_partial",
      variant: "outlined",
    });
  }
  buttons.push({
    title: t(locale, "modal.consent_required.buttons.cancel"),
    action: "cancel",
    severity: "secondary",
    variant: "text",
  });

  return {
    type: "modal",
    title: t(locale, "modal.consent_required.title"),
    description: t(locale, "modal.consent_required.description", values),
    data: { total, available, availableAlready, reason: "consent" },
    buttons,
  };
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

  const locale = getUserLocale(user.user_metadata || {});
  const supabaseAdmin = createSupabaseAdmin();

  try {
    const contacts = await getSelectedContacts(
      supabaseAdmin,
      user.id,
      selectedEmails,
    );
    const consentedContacts = contacts.filter(
      (c) => c.consent_status !== "opt_out",
    );

    if (consentedContacts.length === 0) {
      return c.json(
        buildModalResponse(
          locale,
          "no_consented_contacts",
          selectedEmails.length,
          0,
          0,
        ),
        400,
      );
    }

    const billingEnabled = Deno.env.get("ENABLE_CREDIT") === "true";
    let eligibleCount = consentedContacts.length;

    if (billingEnabled) {
      try {
        const { data, error } = await supabaseAdmin.functions.invoke(
          "billing/campaign/quota",
          {
            body: {
              userId: user.id,
              units: consentedContacts.length,
            },
          },
        );

        if (error) {
          logger.error("Billing quota check failed", {
            error: error.message,
            userId: user.id,
          });
          return c.json(
            {
              error: "Billing service unavailable",
              code: "BILLING_UNAVAILABLE",
            },
            503,
          );
        }

        if (!data?.hasCredits && !data?.available) {
          // No credits at all
          const billingUrl = Deno.env.get("BILLING_URL") || "/billing";
          return c.json(
            buildModalResponse(
              locale,
              "insufficient_credits",
              consentedContacts.length,
              data?.available ?? 0,
              0,
              billingUrl,
            ),
            402,
          );
        }

        eligibleCount = Math.min(consentedContacts.length, data.available);

        // If partial credits (can't send to all)
        if (eligibleCount < consentedContacts.length) {
          const billingUrl = Deno.env.get("BILLING_URL") || "/billing";

          if (!payload.partialCampaign) {
            return c.json(
              buildModalResponse(
                locale,
                "partial_credits",
                consentedContacts.length,
                eligibleCount,
                0,
                billingUrl,
              ),
              266 as unknown as Parameters<typeof c.json>[1],
            );
          }
        }
      } catch (error) {
        logger.error("Billing quota check exception", {
          error,
          userId: user.id,
        });
        return c.json(
          { error: "Billing verification failed", code: "BILLING_ERROR" },
          500,
        );
      }
    }

    if (eligibleCount < selectedEmails.length && !payload.partialCampaign) {
      const reason =
        eligibleCount === consentedContacts.length ? "consent" : "credits";

      return c.json(
        buildModalResponse(
          locale,
          reason === "consent" ? "consent_required" : "partial_credits",
          selectedEmails.length,
          eligibleCount,
          0,
        ),
        266 as unknown as Parameters<typeof c.json>[1],
      );
    }

    const finalEmails = consentedContacts
      .slice(0, eligibleCount)
      .map((c) => c.email);

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
