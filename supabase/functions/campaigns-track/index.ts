import { Context, Hono } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("campaigns-track");
const functionName = "campaigns-track";
const app = new Hono().basePath(`/${functionName}`);

const FRONTEND_HOST = Deno.env.get("FRONTEND_HOST") || "";

app.onError((err, c) => {
  logger.error("Unhandled error", {
    path: c.req.path,
    method: c.req.method,
    error: err.message,
  });
  return c.json({ error: "Internal error" }, 500);
});

function buildRedirectResponse(url: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
}

// ==================== CLICK TRACKING ====================

app.get("/click/:token", async (c: Context) => {
  const token = c.req.param("token");
  const supabaseAdmin = createSupabaseAdmin();

  // Try SMS click tracking first
  const { data: smsClick, error: smsError } = await supabaseAdmin
    .schema("private")
    .from("sms_campaign_link_clicks")
    .select("*, campaign:sms_campaigns(id, user_id, click_count)")
    .eq("token", token)
    .single();

  if (smsClick && !smsError) {
    // SMS click found - increment counter and redirect
    const campaignId = smsClick.campaign?.id;
    const currentClickCount = smsClick.campaign?.click_count || 0;
    if (campaignId) {
      await supabaseAdmin
        .schema("private")
        .from("sms_campaigns")
        .update({ click_count: currentClickCount + 1 })
        .eq("id", campaignId);
    }

    const targetUrl = smsClick.url;
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return c.redirect("/", 302);
    }
    return c.redirect(targetUrl, 302);
  }

  // Try Email click tracking
  const { data: emailLink, error: emailError } = await supabaseAdmin
    .schema("private")
    .from("email_campaign_links")
    .select("url, campaign_id, recipient_id")
    .eq("short_token", token)
    .single();

  if (emailLink && !emailError) {
    // Email click found - record event and redirect
    await supabaseAdmin.schema("private").from("email_campaign_events").insert({
      campaign_id: emailLink.campaign_id,
      recipient_id: emailLink.recipient_id,
      event_type: "click",
      url: emailLink.url,
    });

    return buildRedirectResponse(emailLink.url);
  }

  // No match found
  logger.warn("Click token not found", { token });
  return c.redirect("/", 302);
});

// ==================== OPEN TRACKING (Email only) ====================

app.get("/open/:token", async (c: Context) => {
  const token = c.req.param("token");
  const supabaseAdmin = createSupabaseAdmin();

  const { data: recipient } = await supabaseAdmin
    .schema("private")
    .from("email_campaign_recipients")
    .select("id, campaign_id")
    .eq("open_short_token", token)
    .single();

  if (recipient) {
    await supabaseAdmin.schema("private").from("email_campaign_events").insert({
      campaign_id: recipient.campaign_id,
      recipient_id: recipient.id,
      event_type: "open",
    });
  }

  // Return 1x1 transparent GIF
  const pixel = Uint8Array.from(
    atob("R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="),
    (char) => char.charCodeAt(0),
  );

  return new Response(pixel, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store",
    },
  });
});

// ==================== UNSUBSCRIBE ====================

app.get("/unsubscribe/:token", async (c: Context) => {
  const token = c.req.param("token");
  const supabaseAdmin = createSupabaseAdmin();

  // Try SMS unsubscribe first
  const { data: smsRecipient, error: smsError } = await supabaseAdmin
    .schema("private")
    .from("sms_campaign_recipients")
    .select("id, campaign_id, phone, campaign:sms_campaigns(user_id)")
    .eq("unsubscribe_short_token", token)
    .single();

  const smsCampaignOwner = Array.isArray(smsRecipient?.campaign)
    ? smsRecipient?.campaign[0]
    : smsRecipient?.campaign;

  if (
    smsRecipient &&
    !smsError &&
    smsCampaignOwner?.user_id &&
    smsRecipient.phone
  ) {
    // SMS unsubscribe
    const userId = smsCampaignOwner.user_id as string;
    const phone = smsRecipient.phone as string;

    const { data: existing } = await supabaseAdmin
      .schema("private")
      .from("sms_campaign_unsubscribes")
      .select("id")
      .eq("user_id", userId)
      .eq("phone", phone)
      .single();

    if (!existing) {
      await supabaseAdmin
        .schema("private")
        .from("sms_campaign_unsubscribes")
        .insert({
          user_id: userId,
          phone,
          campaign_id: smsRecipient.campaign_id,
        });
    }

    return c.html(
      "<html><body><h1>You have been unsubscribed from SMS campaigns.</h1></body></html>",
    );
  }

  // Try Email unsubscribe
  const { data: emailRecipient, error: emailError } = await supabaseAdmin
    .schema("private")
    .from("email_campaign_recipients")
    .select("id, campaign_id, user_id, contact_email")
    .eq("unsubscribe_short_token", token)
    .single();

  if (emailRecipient && !emailError) {
    // Update consent status
    await supabaseAdmin
      .schema("private")
      .from("persons")
      .update({
        consent_status: "opt_out",
        consent_changed_at: new Date().toISOString(),
      })
      .eq("user_id", emailRecipient.user_id)
      .eq("email", emailRecipient.contact_email);

    // Mark pending recipients as skipped
    await supabaseAdmin
      .schema("private")
      .from("email_campaign_recipients")
      .update({
        send_status: "skipped",
        last_error: "Recipient unsubscribed",
      })
      .eq("user_id", emailRecipient.user_id)
      .eq("contact_email", emailRecipient.contact_email)
      .eq("send_status", "pending");

    // Record unsubscribe event
    await supabaseAdmin.schema("private").from("email_campaign_events").insert({
      campaign_id: emailRecipient.campaign_id,
      recipient_id: emailRecipient.id,
      event_type: "unsubscribe",
    });

    // Get sender email for success page
    let senderEmail = "";
    try {
      const { data: profile } = await supabaseAdmin
        .schema("private")
        .from("profiles")
        .select("email")
        .eq("user_id", emailRecipient.user_id)
        .maybeSingle();
      senderEmail = profile?.email || "";
    } catch (e) {
      logger.error("Failed to fetch sender email", {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const successUrl = senderEmail
      ? `${FRONTEND_HOST}/unsubscribe/success?sender=${encodeURIComponent(senderEmail)}`
      : `${FRONTEND_HOST}/unsubscribe/success`;

    return buildRedirectResponse(successUrl);
  }

  // No match found
  return buildRedirectResponse(`${FRONTEND_HOST}/unsubscribe/failure`);
});

Deno.serve((req) => app.fetch(req));
export default app;
