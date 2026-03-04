import { Context, Hono } from "hono";
import corsHeaders from "../_shared/cors.ts";
import { createSupabaseAdmin, createSupabaseClient } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { resolveCampaignBaseUrlFromEnv } from "../_shared/url.ts";
import { createSmsProvider } from "./providers/mod.ts";
import type { SendSmsResult } from "./providers/types.ts";
import { getSmsQuota, getLocalTimeBounds } from "./utils/quota.ts";
import { shortenUrl } from "./utils/short-link.ts";

const logger = createLogger("sms-campaigns");

const functionName = "sms-campaigns";
const app = new Hono().basePath(`/${functionName}`);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const PUBLIC_CAMPAIGN_BASE_URL = resolveCampaignBaseUrlFromEnv((key) => Deno.env.get(key));

type SmsCampaignStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";
type RecipientStatus = "pending" | "sent" | "failed" | "skipped";

type SmsCampaignCreatePayload = {
  selectedPhones?: string[];
  senderName: string;
  senderPhone: string;
  provider: "twilio" | "smsgate";
  messageTemplate: string;
  useShortLinks?: boolean;
  dailyLimit?: number;
  timezone?: string;
};

async function authMiddleware(c: Context, next: () => Promise<void>) {
  const authHeader = c.req.header("authorization");

  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  if (authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    await next();
    return;
  }

  const supabase = createSupabaseClient(authHeader);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user?.id || !data.user.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", data.user);
  await next();
}

app.use("*", async (c, next) => {
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

app.options("*", () => new Response("ok", { headers: corsHeaders }));

app.get("/health", (c) => c.json({ status: "ok", service: functionName }));

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function normalizePhoneNumber(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-\(\)\.\+]/g, "");
  const e164Match = cleaned.match(/^\+?(\d{10,15})$/);
  if (!e164Match) return null;
  const digits = e164Match[1];
  if (digits.length >= 10) {
    return `+${digits}`;
  }
  return null;
}

function isValidPhoneNumber(phone: string | null): boolean {
  if (!phone) return false;
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return false;
  return normalized.replace(/\D/g, "").length >= 10;
}

async function checkSmsQuota(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  recipientCount: number,
  timezone: string,
): Promise<{ allowed: boolean; remainingDaily: number; remainingMonthly: number; error?: string }> {
  const quota = getSmsQuota();
  const { dayStart, monthStart } = getLocalTimeBounds(timezone);

  const { data: recentCampaigns, error } = await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .select("id, created_at, recipient_count, sent_count")
    .eq("user_id", userId)
    .gte("created_at", monthStart.toISOString());

  if (error) {
    return { allowed: false, remainingDaily: 0, remainingMonthly: 0, error: error.message };
  }

  const monthlyRecipientTotal = (recentCampaigns || []).reduce(
    (sum, c) => sum + (c.recipient_count || 0),
    0,
  );

  const dailyCampaigns = (recentCampaigns || []).filter(
    (c) => new Date(c.created_at) >= dayStart,
  );
  const dailySmsTotal = dailyCampaigns.reduce(
    (sum, c) => sum + (c.sent_count || 0),
    0,
  );

  const effectiveDailyLimit = quota.dailyLimit === 0 ? Infinity : quota.dailyLimit;
  const effectiveMonthlyLimit = quota.monthlyRecipientLimit === 0 ? Infinity : quota.monthlyRecipientLimit;

  const remainingDaily = Math.max(0, effectiveDailyLimit - dailySmsTotal);
  const remainingMonthly = Math.max(0, effectiveMonthlyLimit - monthlyRecipientTotal);

  if (recipientCount > remainingMonthly) {
    return {
      allowed: false,
      remainingDaily,
      remainingMonthly,
      error: `Monthly recipient limit exceeded. You have ${remainingMonthly} recipients remaining this month.`,
    };
  }

  if (recipientCount > remainingDaily) {
    return {
      allowed: false,
      remainingDaily,
      remainingMonthly,
      error: `Daily SMS limit exceeded. You have ${remainingDaily} SMS remaining today.`,
    };
  }

  return { allowed: true, remainingDaily, remainingMonthly };
}

async function recordClickLink(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  campaignId: string,
  recipientId: string,
  url: string,
): Promise<string> {
  const token = crypto.randomUUID();
  const { error } = await supabaseAdmin
    .schema("private")
    .from("sms_campaign_link_clicks")
    .insert({
      campaign_id: campaignId,
      recipient_id: recipientId,
      token,
      url,
    });

  if (error) {
    throw new Error(`Failed to record click link: ${error.message}`);
  }

  return token;
}

async function injectTrackers(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  campaignId: string,
  recipientId: string,
  message: string,
  useShortLinks: boolean,
): Promise<string> {
  const hrefRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = [...message.matchAll(hrefRegex)];
  let updatedMessage = message;

  for (const match of matches) {
    const originalUrl = match[1];
    if (!originalUrl) continue;

    const token = await recordClickLink(supabaseAdmin, campaignId, recipientId, originalUrl);
    let trackedUrl = `${PUBLIC_CAMPAIGN_BASE_URL}/functions/v1/sms-campaigns/track/click/${token}`;

    if (useShortLinks) {
      const shortUrl = await shortenUrl(trackedUrl);
      if (shortUrl) {
        trackedUrl = shortUrl;
      }
    }

    updatedMessage = updatedMessage.replace(originalUrl, trackedUrl);
  }

  return updatedMessage;
}

function generateUnsubscribeToken(userId: string, phone: string): string {
  const data = `${userId}:${phone}:${Date.now()}`;
  return btoa(data);
}

app.post("/campaigns/create", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  logger.info("Creating SMS campaign", { userId: user.id });

  const payload = (await c.req.json().catch(() => ({}))) as SmsCampaignCreatePayload;
  const { selectedPhones, senderName, senderPhone, provider, messageTemplate, useShortLinks, dailyLimit, timezone } = payload;

  if (!senderName || !senderPhone || !provider || !messageTemplate) {
    return c.json({ error: "Missing required fields", code: "MISSING_REQUIRED_FIELDS" }, 400);
  }

  if (!selectedPhones || selectedPhones.length === 0) {
    return c.json({ error: "No recipients selected", code: "NO_RECIPIENTS" }, 400);
  }

  const validPhones = selectedPhones.filter(isValidPhoneNumber).map(normalizePhoneNumber!);
  const uniquePhones = [...new Set(validPhones)];

  if (uniquePhones.length === 0) {
    return c.json({ error: "No valid phone numbers found", code: "NO_VALID_PHONES" }, 400);
  }

  const userTimezone = timezone || "UTC";
  const supabaseAdmin = createSupabaseAdmin();

  const quotaCheck = await checkSmsQuota(supabaseAdmin, user.id, uniquePhones.length, userTimezone);
  if (!quotaCheck.allowed) {
    return c.json({ error: quotaCheck.error, code: "QUOTA_EXCEEDED", remainingDaily: quotaCheck.remainingDaily, remainingMonthly: quotaCheck.remainingMonthly }, 403);
  }

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .insert({
      user_id: user.id,
      sender_name: senderName,
      sender_phone: senderPhone,
      provider,
      message_template: messageTemplate,
      use_short_links: useShortLinks || false,
      recipient_count: uniquePhones.length,
      status: "queued",
    })
    .select()
    .single();

  if (campaignError || !campaign) {
    return c.json({ error: extractErrorMessage(campaignError), code: "CREATE_FAILED" }, 500);
  }

  const recipientRecords = uniquePhones.map((phone) => ({
    campaign_id: campaign.id,
    phone,
    message: messageTemplate,
    send_status: "pending" as RecipientStatus,
  }));

  const { error: recipientsError } = await supabaseAdmin
    .schema("private")
    .from("sms_campaign_recipients")
    .insert(recipientRecords);

  if (recipientsError) {
    await supabaseAdmin.schema("private").from("sms_campaigns").delete().eq("id", campaign.id);
    return c.json({ error: extractErrorMessage(recipientsError), code: "RECIPIENTS_FAILED" }, 500);
  }

  return c.json({ campaignId: campaign.id, recipientCount: uniquePhones.length });
});

app.post("/campaigns/preview", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const payload = (await c.req.json().catch(() => ({}))) as SmsCampaignCreatePayload;
  const { senderName, senderPhone, provider, messageTemplate, useShortLinks, selectedPhones } = payload;

  if (!senderName || !senderPhone || !provider || !messageTemplate) {
    return c.json({ error: "Missing required fields", code: "MISSING_REQUIRED_FIELDS" }, 400);
  }

  const unsubscribeToken = generateUnsubscribeToken(user.id, selectedPhones?.[0] || "+0000000000");
  const unsubscribeUrl = `${PUBLIC_CAMPAIGN_BASE_URL}/functions/v1/sms-campaigns/unsubscribe/${unsubscribeToken}`;
  const footerText = `\n\nUnsubscribe me: ${unsubscribeUrl}`;
  
  let previewMessage = messageTemplate + footerText;

  const supabaseAdmin = createSupabaseAdmin();
  if (useShortLinks) {
    const hrefRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = [...previewMessage.matchAll(hrefRegex)];
    
    for (const match of matches) {
      const originalUrl = match[1];
      if (!originalUrl) continue;
      
      const tempToken = crypto.randomUUID();
      const trackedUrl = `${PUBLIC_CAMPAIGN_BASE_URL}/functions/v1/sms-campaigns/track/click/${tempToken}`;
      const shortUrl = await shortenUrl(trackedUrl);
      
      if (shortUrl) {
        previewMessage = previewMessage.replace(originalUrl, shortUrl);
      }
    }
  }

  const charCount = previewMessage.length;
  const isUnicode = /[^\u0000-\u007F]/.test(previewMessage);
  const maxPerSms = isUnicode ? 70 : 160;
  const parts = Math.ceil(previewMessage.length / maxPerSms);

  return c.json({
    preview: previewMessage,
    charCount,
    encoding: isUnicode ? "Unicode" : "GSM-7",
    parts,
  });
});

app.get("/campaigns", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const supabaseAdmin = createSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("get_unified_campaigns_overview");

  if (error) {
    return c.json({ error: extractErrorMessage(error), code: "FETCH_FAILED" }, 500);
  }

  const smsCampaigns = (data || []).filter((row: Record<string, unknown>) => row.channel === "sms");
  return c.json({ campaigns: smsCampaigns });
});

app.get("/campaigns/:id", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const campaignId = c.req.param("id");
  const supabaseAdmin = createSupabaseAdmin();

  const { data: campaign, error } = await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (error || !campaign) {
    return c.json({ error: "Campaign not found", code: "NOT_FOUND" }, 404);
  }

  const { data: recipients } = await supabaseAdmin
    .schema("private")
    .from("sms_campaign_recipients")
    .select("*")
    .eq("campaign_id", campaignId);

  return c.json({ campaign, recipients });
});

app.post("/campaigns/:id/stop", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const campaignId = c.req.param("id");
  const supabaseAdmin = createSupabaseAdmin();

  const { data: campaign, error: fetchError } = await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .select("status")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !campaign) {
    return c.json({ error: "Campaign not found", code: "NOT_FOUND" }, 404);
  }

  if (campaign.status !== "queued" && campaign.status !== "processing") {
    return c.json({ error: "Cannot stop campaign in current status", code: "INVALID_STATUS" }, 400);
  }

  await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", campaignId);

  return c.json({ success: true });
});

app.delete("/campaigns/:id", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const campaignId = c.req.param("id");
  const supabaseAdmin = createSupabaseAdmin();

  const { error } = await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("user_id", user.id);

  if (error) {
    return c.json({ error: extractErrorMessage(error), code: "DELETE_FAILED" }, 500);
  }

  return c.json({ success: true });
});

app.get("/track/click/:token", async (c: Context) => {
  const token = c.req.param("token");
  const supabaseAdmin = createSupabaseAdmin();

  const { data: click, error } = await supabaseAdmin
    .schema("private")
    .from("sms_campaign_link_clicks")
    .select("*, campaign:sms_campaigns(id, user_id, click_count)")
    .eq("token", token)
    .single();

  if (error || !click) {
    return c.redirect("/", 302);
  }

  const campaignId = click.campaign?.id;
  const currentClickCount = click.campaign?.click_count || 0;
  if (campaignId) {
    await supabaseAdmin
      .schema("private")
      .from("sms_campaigns")
      .update({ click_count: currentClickCount + 1 })
      .eq("id", campaignId);
  }

  const targetUrl = click.url;
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return c.redirect("/", 302);
  }

  return c.redirect(targetUrl, 302);
});

app.get("/unsubscribe/:token", async (c: Context) => {
  const token = c.req.param("token");
  
  try {
    const decoded = atob(token);
    const [userId, phone] = decoded.split(":");
    
    if (!userId || !phone) {
      return c.html("<html><body><h1>Invalid unsubscribe link</h1></body></html>");
    }

    const supabaseAdmin = createSupabaseAdmin();
    
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
        .insert({ user_id: userId, phone });
    }

    return c.html("<html><body><h1>You have been unsubscribed from SMS campaigns.</h1></body></html>");
  } catch {
    return c.html("<html><body><h1>Invalid unsubscribe link</h1></body></html>");
  }
});

app.post("/process", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const { campaignId } = (await c.req.json().catch(() => ({}))) as { campaignId?: string };

  if (!campaignId) {
    return c.json({ error: "Campaign ID required", code: "MISSING_CAMPAIGN_ID" }, 400);
  }

  logger.info("Processing SMS campaign", { campaignId, userId: user.id });

  const supabaseAdmin = createSupabaseAdmin();

  const { data: campaign, error: fetchError } = await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !campaign) {
    return c.json({ error: "Campaign not found", code: "NOT_FOUND" }, 404);
  }

  if (campaign.status !== "queued") {
    return c.json({ error: "Campaign already processed", code: "INVALID_STATUS" }, 400);
  }

  await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", campaignId);

  const { data: recipients } = await supabaseAdmin
    .schema("private")
    .from("sms_campaign_recipients")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("send_status", "pending");

  const smsProvider = createSmsProvider(campaign.provider as "twilio" | "smsgate");
  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients || []) {
    try {
      let messageWithTrackers = await injectTrackers(
        supabaseAdmin,
        campaignId,
        recipient.id,
        campaign.message_template,
        campaign.use_short_links,
      );

      const unsubscribeToken = generateUnsubscribeToken(user.id, recipient.phone);
      const unsubscribeUrl = `${PUBLIC_CAMPAIGN_BASE_URL}/functions/v1/sms-campaigns/unsubscribe/${unsubscribeToken}`;
      messageWithTrackers += `\n\nUnsubscribe me: ${unsubscribeUrl}`;

      const result: SendSmsResult = await smsProvider.send({
        to: recipient.phone,
        from: campaign.sender_phone,
        body: messageWithTrackers,
      });

      if (result.success) {
        await supabaseAdmin
          .schema("private")
          .from("sms_campaign_recipients")
          .update({
            send_status: "sent",
            provider_message_id: result.messageId,
            sent_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);
        sentCount++;
      } else {
        await supabaseAdmin
          .schema("private")
          .from("sms_campaign_recipients")
          .update({
            send_status: "failed",
            provider_error: result.error,
            attempt_count: recipient.attempt_count + 1,
          })
          .eq("id", recipient.id);
        failedCount++;
      }
    } catch (err) {
      await supabaseAdmin
        .schema("private")
        .from("sms_campaign_recipients")
        .update({
          send_status: "failed",
          provider_error: extractErrorMessage(err),
          attempt_count: recipient.attempt_count + 1,
        })
        .eq("id", recipient.id);
      failedCount++;
    }
  }

  await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .update({
      status: "completed",
      sent_count: sentCount,
      failed_count: failedCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return c.json({ success: true, sentCount, failedCount });
});

Deno.serve((req) => app.fetch(req));

export default app;