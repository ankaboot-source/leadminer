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

export async function checkComplianceMiddleware(c: Context, next: Next) {
  if (!c.req.path.endsWith("/campaigns/create")) {
    return next();
  }

  let payload: { selectedEmails?: string[] };

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
    const contacts = await getSelectedContacts(
      supabaseAdmin,
      user.id,
      selectedEmails,
    );

    const consentedContacts = contacts.filter(
      (contact) => contact.consent_status !== "opt_out",
    );

    if (consentedContacts.length === 0) {
      return c.json(
        {
          error: "No contacts with consent",
          code: "NO_CONSENTED_CONTACTS",
        },
        400,
      );
    }

    if (consentedContacts.length < selectedEmails.length) {
      return new Response(
        JSON.stringify({
          total: selectedEmails.length,
          available: consentedContacts.length,
          availableAlready: 0,
          reason: "consent",
        }),
        {
          status: 266,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    c.set("filteredEmails", consentedContacts.map((c) => c.email));

    await next();
  } catch (error) {
    console.error("Compliance check failed:", error);
    return c.json(
      {
        error: "Failed to validate contact consent",
        code: "COMPLIANCE_CHECK_FAILED",
      },
      500,
    );
  }
}
