import { Context, Next } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("email-campaigns:check");

interface ContactSnapshot {
  email: string;
  consent_status: "legitimate_interest" | "opt_out" | "opt_in";
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
        { error: "No contacts with consent", code: "NO_CONSENTED_CONTACTS" },
        400,
      );
    }

    const billingEnabled = Deno.env.get("ENABLE_BILLING") === "true";
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
          return c.json(
            {
              total: consentedContacts.length,
              available: data?.available ?? 0,
              availableAlready: 0,
              reason: "credits",
            },
            402,
          );
        }

        eligibleCount = Math.min(consentedContacts.length, data.available);
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
        {
          total: selectedEmails.length,
          available: eligibleCount,
          availableAlready: 0,
          reason,
        },
        266,
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

    await next();
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
