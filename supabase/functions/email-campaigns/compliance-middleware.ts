import { Context, Next } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";

interface ContactSnapshot {
  email: string;
  consent_status: "legitimate_interest" | "opt_out" | "opt_in";
  status: string | null;
}

async function getSelectedContacts(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  emails: string[],
): Promise<ContactSnapshot[]> {
  const { data, error } = await supabaseAdmin
    .schema("private")
    .from("persons")
    .select("email, consent_status, status")
    .eq("user_id", userId)
    .in("email", emails);

  if (error) {
    throw new Error(`Failed to fetch contacts: ${error.message}`);
  }

  return (data || []).map((row) => ({
    email: row.email,
    consent_status: row.consent_status || "legitimate_interest",
    status: row.status,
  }));
}

export async function complianceMiddleware(c: Context, next: Next) {
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
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  const selectedEmails = payload.selectedEmails || [];

  if (selectedEmails.length === 0) {
    return c.json({ error: "No contacts selected", code: "NO_CONTACTS" }, 400);
  }

  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const supabaseAdmin = createSupabaseAdmin();

  try {
    // Fetch and filter consented contacts
    const contacts = await getSelectedContacts(supabaseAdmin, user.id, selectedEmails);
    const consentedContacts = contacts.filter((c) => c.consent_status !== "opt_out");

    if (consentedContacts.length === 0) {
      return c.json(
        { error: "No contacts with consent", code: "NO_CONSENTED_CONTACTS" },
        400
      );
    }

    // Check billing if enabled
    const billingEnabled = Deno.env.get("ENABLE_BILLING") === "true";
    let availableCount = consentedContacts.length;

    if (billingEnabled) {
      try {
        const { data, error } = await supabaseAdmin.functions.invoke(
          "billing/campaign/charge",
          {
            body: {
              userId: user.id,
              units: consentedContacts.length,
              partialCampaign: payload.partialCampaign ?? false,
            },
          }
        );

        if (error) {
          return c.json({ error: "Billing service unavailable" }, 503);
        }

        // Forward billing responses
        if (data?.status === 402 || data?.status === 266) {
          return c.json(
            { ...data.payload, reason: "credits" },
            data.status
          );
        }

        if (data?.status === 200) {
          availableCount = data.payload?.chargedUnits ?? consentedContacts.length;
        } else {
          return c.json({ error: "Billing verification failed" }, 500);
        }
      } catch (error) {
        console.error("Billing check failed:", error);
        return c.json({ error: "Billing verification failed" }, 500);
      }
    }

    // Check if limited and user hasn't confirmed partial
    if (availableCount < selectedEmails.length && !payload.partialCampaign) {
      const reason = availableCount === consentedContacts.length ? "credits" : "consent";
      return c.json(
        {
          total: selectedEmails.length,
          available: availableCount,
          availableAlready: 0,
          reason,
        },
        266
      );
    }

    // Modify request body with filtered emails
    const finalEmails = consentedContacts
      .slice(0, availableCount)
      .map((c) => c.email);
    
    // Re-parse and set modified body
    c.req.json = async () => ({
      ...payload,
      selectedEmails: finalEmails,
    });

    await next();
  } catch (error) {
    console.error("Compliance check failed:", error);
    return c.json(
      { error: "Failed to validate campaign constraints" },
      500
    );
  }
}
