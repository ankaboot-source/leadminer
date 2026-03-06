import { Context, Hono } from "hono";
import corsHeaders from "../_shared/cors.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
} from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { resolveCampaignBaseUrlFromEnv } from "../_shared/url.ts";
import { generateShortToken } from "../_shared/short-token.ts";
import {
  createSmsProvider,
  isTwilioFallbackAvailable,
  type SmsGateCredentials,
  TwilioProvider,
} from "./providers/mod.ts";
import type { SendSmsResult } from "./providers/types.ts";
import { getSmsQuota, getLocalTimeBounds } from "./utils/quota.ts";
import { shortenUrl } from "./utils/short-link.ts";
import { isValidPhoneNumber, normalizePhoneNumber } from "./utils/phone.ts";
import { estimateSmsSegments } from "./utils/sms-segments.ts";

const logger = createLogger("sms-campaigns");

const functionName = "sms-campaigns";
const app = new Hono().basePath(`/${functionName}`);

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
) as string;
const PUBLIC_CAMPAIGN_BASE_URL = resolveCampaignBaseUrlFromEnv((key) =>
  Deno.env.get(key),
);

type RecipientStatus = "pending" | "sent" | "failed" | "skipped";

type SmsCampaignCreatePayload = {
  selectedPhones?: string[];
  senderName: string;
  senderPhone: string;
  messageTemplate: string;
  useShortLinks?: boolean;
  provider?: "smsgate" | "twilio";
  smsgateConfig?: {
    baseUrl?: string;
    username?: string;
    password?: string;
  };
  timezone?: string;
};

type SmsGateProfileConfig = {
  smsgate_base_url: string | null;
  smsgate_username: string | null;
  smsgate_password: string | null;
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

async function getUserSmsGateConfig(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
): Promise<SmsGateProfileConfig> {
  const { data, error } = await supabaseAdmin
    .schema("private")
    .from("profiles")
    .select("smsgate_base_url,smsgate_username,smsgate_password")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return {
      smsgate_base_url: null,
      smsgate_username: null,
      smsgate_password: null,
    };
  }

  return data as SmsGateProfileConfig;
}

function toSmsGateCredentials(
  config: SmsGateProfileConfig,
): SmsGateCredentials | null {
  if (!config.smsgate_username || !config.smsgate_password) {
    return null;
  }

  return {
    baseUrl: config.smsgate_base_url || "https://api.sms-gate.app",
    username: config.smsgate_username,
    password: config.smsgate_password,
  };
}

app.get("/providers/status", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const supabaseAdmin = createSupabaseAdmin();
  const config = await getUserSmsGateConfig(supabaseAdmin, user.id);

  return c.json({
    smsgateConfigured: Boolean(
      config.smsgate_username && config.smsgate_password,
    ),
    smsgateBaseUrl: config.smsgate_base_url || "https://api.sms-gate.app",
    smsgateUsername: config.smsgate_username || "",
    twilioFallbackAvailable: isTwilioFallbackAvailable(),
  });
});

app.post("/providers/smsgate", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const payload = (await c.req.json().catch(() => ({}))) as {
    baseUrl?: string;
    username?: string;
    password?: string;
  };

  const supabaseAdmin = createSupabaseAdmin();
  const existingConfig = await getUserSmsGateConfig(supabaseAdmin, user.id);

  const username =
    payload.username?.trim() || existingConfig.smsgate_username || "";
  const password =
    payload.password?.trim() || existingConfig.smsgate_password || "";
  const baseUrl =
    payload.baseUrl?.trim() ||
    existingConfig.smsgate_base_url ||
    "https://api.sms-gate.app";

  if (!username || !password) {
    return c.json(
      {
        error: "Missing SMSGate credentials",
        code: "MISSING_SMSGATE_CREDENTIALS",
      },
      400,
    );
  }

  const { error } = await supabaseAdmin
    .schema("private")
    .from("profiles")
    .update({
      smsgate_base_url: baseUrl,
      smsgate_username: username,
      smsgate_password: password,
    })
    .eq("user_id", user.id);

  if (error) {
    return c.json(
      { error: extractErrorMessage(error), code: "SAVE_CREDENTIALS_FAILED" },
      500,
    );
  }

  return c.json({ success: true });
});

app.get("/quota", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const timezone = c.req.query("timezone") || "UTC";
  const quota = getSmsQuota();
  const supabaseAdmin = createSupabaseAdmin();
  const { dayStart, monthStart } = getLocalTimeBounds(timezone);

  const { data: recentCampaigns } = await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .select("id, created_at, recipient_count, sent_count")
    .eq("user_id", user.id)
    .gte("created_at", monthStart.toISOString());

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

  const dailyLimit = quota.dailyLimit;
  const monthlyLimit = quota.monthlyRecipientLimit;
  const remainingDaily =
    dailyLimit === 0 ? null : Math.max(0, dailyLimit - dailySmsTotal);
  const remainingMonthly =
    monthlyLimit === 0
      ? null
      : Math.max(0, monthlyLimit - monthlyRecipientTotal);

  return c.json({
    dailyLimit,
    monthlyLimit,
    usedDaily: dailySmsTotal,
    usedMonthly: monthlyRecipientTotal,
    remainingDaily,
    remainingMonthly,
  });
});

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

async function checkSmsQuota(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  recipientCount: number,
  timezone: string,
): Promise<{
  allowed: boolean;
  remainingDaily: number;
  remainingMonthly: number;
  error?: string;
}> {
  const quota = getSmsQuota();
  const { dayStart, monthStart } = getLocalTimeBounds(timezone);

  const { data: recentCampaigns, error } = await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .select("id, created_at, recipient_count, sent_count")
    .eq("user_id", userId)
    .gte("created_at", monthStart.toISOString());

  if (error) {
    return {
      allowed: false,
      remainingDaily: 0,
      remainingMonthly: 0,
      error: error.message,
    };
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

  const effectiveDailyLimit =
    quota.dailyLimit === 0 ? Infinity : quota.dailyLimit;
  const effectiveMonthlyLimit =
    quota.monthlyRecipientLimit === 0 ? Infinity : quota.monthlyRecipientLimit;

  const remainingDaily = Math.max(0, effectiveDailyLimit - dailySmsTotal);
  const remainingMonthly = Math.max(
    0,
    effectiveMonthlyLimit - monthlyRecipientTotal,
  );

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
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = getUniqueShortToken(8);
    const { error } = await supabaseAdmin
      .schema("private")
      .from("sms_campaign_link_clicks")
      .insert({
        campaign_id: campaignId,
        recipient_id: recipientId,
        token,
        url,
      });

    if (!error) {
      return token;
    }

    if (
      !error.message.includes("duplicate") &&
      !error.message.includes("unique")
    ) {
      throw new Error(`Failed to record click link: ${error.message}`);
    }
  }

  throw new Error(
    "Unable to generate unique short token for SMS click tracker",
  );
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

    const token = await recordClickLink(
      supabaseAdmin,
      campaignId,
      recipientId,
      originalUrl,
    );
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

function getUniqueShortToken(length = 8): string {
  return generateShortToken(length);
}

app.post("/campaigns/create", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  logger.info("Creating SMS campaign", { userId: user.id });

  const payload = (await c.req
    .json()
    .catch(() => ({}))) as SmsCampaignCreatePayload;
  const {
    selectedPhones,
    senderName,
    senderPhone,
    messageTemplate,
    useShortLinks,
    provider,
    smsgateConfig,
    timezone,
  } = payload;

  if (!senderName || !senderPhone || !messageTemplate) {
    return c.json(
      { error: "Missing required fields", code: "MISSING_REQUIRED_FIELDS" },
      400,
    );
  }

  if (!selectedPhones || selectedPhones.length === 0) {
    return c.json(
      { error: "No recipients selected", code: "NO_RECIPIENTS" },
      400,
    );
  }

  const validPhones = selectedPhones
    .filter(isValidPhoneNumber)
    .map((phone) => normalizePhoneNumber(phone) as string);
  const uniquePhones = [...new Set(validPhones)];

  if (uniquePhones.length === 0) {
    return c.json(
      { error: "No valid phone numbers found", code: "NO_VALID_PHONES" },
      400,
    );
  }

  const userTimezone = timezone || "UTC";
  const supabaseAdmin = createSupabaseAdmin();

  if (smsgateConfig?.username && smsgateConfig?.password) {
    await supabaseAdmin
      .schema("private")
      .from("profiles")
      .update({
        smsgate_base_url: smsgateConfig.baseUrl || "https://api.sms-gate.app",
        smsgate_username: smsgateConfig.username,
        smsgate_password: smsgateConfig.password,
      })
      .eq("user_id", user.id);
  }

  const selectedProvider = provider || "smsgate";

  const profileConfig = await getUserSmsGateConfig(supabaseAdmin, user.id);
  const smsgateCredentials = toSmsGateCredentials(profileConfig);

  if (selectedProvider === "smsgate" && !smsgateCredentials) {
    return c.json(
      {
        error:
          "SMSGate is not configured. Please add your SMSGate credentials.",
        code: "SMSGATE_NOT_CONFIGURED",
      },
      400,
    );
  }

  if (selectedProvider === "twilio" && !TwilioProvider.isConfigured()) {
    return c.json(
      {
        error:
          "Twilio is not configured. Please configure Twilio environment variables.",
        code: "TWILIO_NOT_CONFIGURED",
      },
      400,
    );
  }

  const quotaCheck = await checkSmsQuota(
    supabaseAdmin,
    user.id,
    uniquePhones.length,
    userTimezone,
  );
  if (!quotaCheck.allowed) {
    return c.json(
      {
        error: quotaCheck.error,
        code: "QUOTA_EXCEEDED",
        remainingDaily: quotaCheck.remainingDaily,
        remainingMonthly: quotaCheck.remainingMonthly,
      },
      403,
    );
  }

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .insert({
      user_id: user.id,
      sender_name: senderName,
      sender_phone: senderPhone,
      provider: selectedProvider,
      message_template: messageTemplate,
      use_short_links: useShortLinks || false,
      recipient_count: uniquePhones.length,
      status: "queued",
    })
    .select()
    .single();

  if (campaignError || !campaign) {
    return c.json(
      { error: extractErrorMessage(campaignError), code: "CREATE_FAILED" },
      500,
    );
  }

  const usedUnsubscribeTokens = new Set<string>();
  const getNextUnsubscribeToken = () => {
    let token = getUniqueShortToken(10);
    while (usedUnsubscribeTokens.has(token)) {
      token = getUniqueShortToken(10);
    }
    usedUnsubscribeTokens.add(token);
    return token;
  };

  const recipientRecords = uniquePhones.map((phone) => ({
    campaign_id: campaign.id,
    phone,
    message: messageTemplate,
    unsubscribe_short_token: getNextUnsubscribeToken(),
    send_status: "pending" as RecipientStatus,
  }));

  const { error: recipientsError } = await supabaseAdmin
    .schema("private")
    .from("sms_campaign_recipients")
    .insert(recipientRecords);

  if (recipientsError) {
    await supabaseAdmin
      .schema("private")
      .from("sms_campaigns")
      .delete()
      .eq("id", campaign.id);
    return c.json(
      {
        error: extractErrorMessage(recipientsError),
        code: "RECIPIENTS_FAILED",
      },
      500,
    );
  }

  return c.json({
    campaignId: campaign.id,
    recipientCount: uniquePhones.length,
  });
});

app.post("/campaigns/preview", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const payload = (await c.req
    .json()
    .catch(() => ({}))) as SmsCampaignCreatePayload;
  const {
    senderName,
    senderPhone,
    messageTemplate,
    useShortLinks,
    selectedPhones,
    smsgateConfig,
  } = payload;

  if (!senderName || !senderPhone || !messageTemplate) {
    return c.json(
      { error: "Missing required fields", code: "MISSING_REQUIRED_FIELDS" },
      400,
    );
  }

  const supabaseAdmin = createSupabaseAdmin();
  if (smsgateConfig?.username && smsgateConfig?.password) {
    await supabaseAdmin
      .schema("private")
      .from("profiles")
      .update({
        smsgate_base_url: smsgateConfig.baseUrl || "https://api.sms-gate.app",
        smsgate_username: smsgateConfig.username,
        smsgate_password: smsgateConfig.password,
      })
      .eq("user_id", user.id);
  }

  const profileConfig = await getUserSmsGateConfig(supabaseAdmin, user.id);
  if (!toSmsGateCredentials(profileConfig)) {
    return c.json(
      {
        error:
          "SMSGate is not configured. Please add your SMSGate credentials.",
        code: "SMSGATE_NOT_CONFIGURED",
      },
      400,
    );
  }

  const unsubscribeToken = getUniqueShortToken(10);
  const unsubscribeUrl = `${PUBLIC_CAMPAIGN_BASE_URL}/functions/v1/sms-campaigns/unsubscribe/${unsubscribeToken}`;
  const footerText = `\n\nUnsubscribe me: ${unsubscribeUrl}`;

  let previewMessage = messageTemplate + footerText;
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

  const segmentEstimate = estimateSmsSegments(previewMessage, false);

  return c.json({
    preview: previewMessage,
    charCount: segmentEstimate.charCount,
    encoding: segmentEstimate.encoding,
    parts: segmentEstimate.parts,
  });
});

app.get("/campaigns", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const supabaseAdmin = createSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("get_sms_campaigns_overview");

  if (error) {
    return c.json(
      { error: extractErrorMessage(error), code: "FETCH_FAILED" },
      500,
    );
  }

  return c.json({ campaigns: data || [] });
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
    return c.json(
      {
        error: "Cannot stop campaign in current status",
        code: "INVALID_STATUS",
      },
      400,
    );
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
    return c.json(
      { error: extractErrorMessage(error), code: "DELETE_FAILED" },
      500,
    );
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
  const supabaseAdmin = createSupabaseAdmin();

  const { data: recipient, error } = await supabaseAdmin
    .schema("private")
    .from("sms_campaign_recipients")
    .select("id, campaign_id, phone, campaign:sms_campaigns(user_id)")
    .eq("unsubscribe_short_token", token)
    .single();

  if (error || !recipient || !recipient.campaign?.user_id || !recipient.phone) {
    return c.html(
      "<html><body><h1>Invalid unsubscribe link</h1></body></html>",
    );
  }

  const userId = recipient.campaign.user_id as string;
  const phone = recipient.phone as string;

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
        campaign_id: recipient.campaign_id,
      });
  }

  return c.html(
    "<html><body><h1>You have been unsubscribed from SMS campaigns.</h1></body></html>",
  );
});

app.post("/process", authMiddleware, async (c: Context) => {
  const user = c.get("user") as { id: string } | undefined;
  const authHeader = c.req.header("authorization") || "";
  const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  if (!user && !isServiceRole) return c.json({ error: "Unauthorized" }, 401);

  const { campaignId } = (await c.req.json().catch(() => ({}))) as {
    campaignId?: string;
  };

  logger.info("Processing SMS campaign", {
    campaignId,
    userId: user?.id,
    viaServiceRole: isServiceRole,
  });

  const supabaseAdmin = createSupabaseAdmin();

  let campaignQuery = supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .select("*");

  if (campaignId) {
    campaignQuery = campaignQuery.eq("id", campaignId);
  } else {
    campaignQuery = campaignQuery
      .eq("status", "queued")
      .order("created_at", {
        ascending: true,
      })
      .limit(1);
  }

  const { data: campaignData, error: fetchError } = await campaignQuery;
  const campaign = Array.isArray(campaignData) ? campaignData[0] : campaignData;

  if (!campaignId && !campaign && !fetchError) {
    return c.json({ success: true, processed: 0 });
  }

  if (fetchError || !campaign) {
    return c.json({ error: "Campaign not found", code: "NOT_FOUND" }, 404);
  }

  if (!isServiceRole && user && campaign.user_id !== user.id) {
    return c.json({ error: "Campaign not found", code: "NOT_FOUND" }, 404);
  }

  if (campaign.status !== "queued") {
    return c.json(
      { error: "Campaign already processed", code: "INVALID_STATUS" },
      400,
    );
  }

  const resolvedCampaignId = campaign.id as string;

  await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", resolvedCampaignId);

  const { data: recipients } = await supabaseAdmin
    .schema("private")
    .from("sms_campaign_recipients")
    .select("*")
    .eq("campaign_id", resolvedCampaignId)
    .eq("send_status", "pending");

  const profileConfig = await getUserSmsGateConfig(
    supabaseAdmin,
    campaign.user_id,
  );
  const smsgateCredentials = toSmsGateCredentials(profileConfig);
  if (!smsgateCredentials) {
    return c.json(
      {
        error: "SMSGate credentials missing for campaign owner",
        code: "SMSGATE_NOT_CONFIGURED",
      },
      400,
    );
  }

  const smsProvider = createSmsProvider("smsgate", {
    smsgate: smsgateCredentials,
  });
  const twilioFallbackEnabled =
    Boolean(campaign.twilio_fallback_enabled) && isTwilioFallbackAvailable();
  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients || []) {
    try {
      let messageWithTrackers = await injectTrackers(
        supabaseAdmin,
        resolvedCampaignId,
        recipient.id,
        campaign.message_template,
        campaign.use_short_links,
      );

      const unsubscribeToken =
        recipient.unsubscribe_short_token || getUniqueShortToken(10);
      if (!recipient.unsubscribe_short_token) {
        await supabaseAdmin
          .schema("private")
          .from("sms_campaign_recipients")
          .update({ unsubscribe_short_token: unsubscribeToken })
          .eq("id", recipient.id);
      }
      const unsubscribeUrl = `${PUBLIC_CAMPAIGN_BASE_URL}/functions/v1/sms-campaigns/unsubscribe/${unsubscribeToken}`;
      messageWithTrackers += `\n\nUnsubscribe me: ${unsubscribeUrl}`;

      let result: SendSmsResult = await smsProvider.send({
        to: recipient.phone,
        from: campaign.sender_phone,
        body: messageWithTrackers,
      });

      let providerUsed = "smsgate";

      if (!result.success && twilioFallbackEnabled) {
        const twilioProvider = createSmsProvider("twilio");
        const fallbackResult = await twilioProvider.send({
          to: recipient.phone,
          from: campaign.sender_phone,
          body: messageWithTrackers,
        });

        if (fallbackResult.success) {
          result = fallbackResult;
          providerUsed = "twilio";
        }
      }

      if (result.success) {
        await supabaseAdmin
          .schema("private")
          .from("sms_campaign_recipients")
          .update({
            send_status: "sent",
            provider_message_id: result.messageId,
            provider_used: providerUsed,
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
            provider_used: twilioFallbackEnabled
              ? "smsgate/twilio_failed"
              : "smsgate",
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
    .eq("id", resolvedCampaignId);

  return c.json({ success: true, sentCount, failedCount });
});

Deno.serve((req) => app.fetch(req));

export default app;
