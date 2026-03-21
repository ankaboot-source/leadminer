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
  type SimpleSmsGatewayCredentials,
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

app.onError((err, c) => {
  logger.error("Unhandled sms-campaigns error", {
    path: c.req.path,
    method: c.req.method,
    error: err.message,
    stack: err.stack,
  });

  return c.json(
    {
      error: "Unexpected server error",
      code: "INTERNAL_ERROR",
      detail: err.message,
    },
    500,
  );
});

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
) as string;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const PUBLIC_CAMPAIGN_BASE_URL = resolveCampaignBaseUrlFromEnv((key) =>
  Deno.env.get(key),
);
const FRONTEND_HOST = Deno.env.get("FRONTEND_HOST") || "";

type RecipientStatus = "pending" | "sent" | "failed" | "skipped";

type SmsCampaignCreatePayload = {
  selectedPhones?: string[];
  selectedRecipients?: Array<{
    phone: string;
    personalization?: Record<string, unknown>;
  }>;
  senderName: string;
  messageTemplate: string;
  footerTextTemplate?: string;
  useShortLinks?: boolean;
  provider?: "smsgate" | "simple-sms-gateway" | "twilio";
  smsgateConfig?: {
    baseUrl?: string;
    username?: string;
    password?: string;
  };
  simpleSmsGatewayConfig?: {
    baseUrl?: string;
  };
  timezone?: string;
};

type SmsTemplateContext = Record<string, unknown>;

function buildSmsUnsubscribeUrl(token: string): string {
  const base = (FRONTEND_HOST || PUBLIC_CAMPAIGN_BASE_URL).replace(/\/$/, "");
  return `${base}/u/${token}`;
}

function buildSmsClickTrackingUrl(token: string): string {
  const base = (FRONTEND_HOST || PUBLIC_CAMPAIGN_BASE_URL).replace(/\/$/, "");
  return `${base}/c/${token}`;
}

type SmsProviderProfileConfig = {
  smsgate_base_url: string | null;
  smsgate_username: string | null;
  smsgate_password: string | null;
  simple_sms_gateway_base_url: string | null;
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
  return;
}

app.use("*", async (c, next) => {
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

app.options("*", () => new Response("ok", { headers: corsHeaders }));

app.get("/health", (c) => c.json({ status: "ok", service: functionName }));

async function getUserSmsProviderConfig(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
): Promise<SmsProviderProfileConfig> {
  const { data, error } = await supabaseAdmin
    .schema("private")
    .from("profiles")
    .select(
      "smsgate_base_url,smsgate_username,smsgate_password,simple_sms_gateway_base_url",
    )
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return {
      smsgate_base_url: null,
      smsgate_username: null,
      smsgate_password: null,
      simple_sms_gateway_base_url: null,
    };
  }

  return data as SmsProviderProfileConfig;
}

async function saveProfileFields(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  fields: Partial<SmsProviderProfileConfig>,
): Promise<unknown> {
  const { error } = await supabaseAdmin
    .schema("private")
    .from("profiles")
    .upsert({ user_id: userId, ...fields }, { onConflict: "user_id" });

  return error;
}

async function triggerSmsCampaignProcessorFromEdge() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing required environment variables", {
      supabaseUrl: !!SUPABASE_URL,
      serviceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
    });
    return;
  }

  await fetch(`${SUPABASE_URL}/functions/v1/sms-campaigns/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({}),
  });
}

function toSmsGateCredentials(
  config: SmsProviderProfileConfig,
): SmsGateCredentials | null {
  if (!config.smsgate_username || !config.smsgate_password) {
    return null;
  }

  return {
    baseUrl:
      config.smsgate_base_url ||
      "https://api.sms-gate.app/3rdparty/v1/messages",
    username: config.smsgate_username,
    password: config.smsgate_password,
  };
}

function toSimpleSmsGatewayCredentials(
  config: SmsProviderProfileConfig,
): SimpleSmsGatewayCredentials | null {
  if (!config.simple_sms_gateway_base_url) {
    return null;
  }

  return {
    baseUrl: config.simple_sms_gateway_base_url,
  };
}

app.get("/providers/status", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const supabaseAdmin = createSupabaseAdmin();
  const config = await getUserSmsProviderConfig(supabaseAdmin, user.id);

  return c.json({
    smsgateConfigured: Boolean(
      config.smsgate_username && config.smsgate_password,
    ),
    smsgateBaseUrl:
      config.smsgate_base_url ||
      "https://api.sms-gate.app/3rdparty/v1/messages",
    smsgateUsername: config.smsgate_username || "",
    simpleSmsGatewayConfigured: Boolean(config.simple_sms_gateway_base_url),
    simpleSmsGatewayBaseUrl:
      config.simple_sms_gateway_base_url ||
      "http://192.168.1.100:8080/send-sms",
    twilioAvailable: isTwilioFallbackAvailable(),
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
  const existingConfig = await getUserSmsProviderConfig(supabaseAdmin, user.id);

  const username =
    payload.username?.trim() || existingConfig.smsgate_username || "";
  const password =
    payload.password?.trim() || existingConfig.smsgate_password || "";
  const baseUrl =
    payload.baseUrl?.trim() ||
    existingConfig.smsgate_base_url ||
    "https://api.sms-gate.app/3rdparty/v1/messages";

  if (!username || !password) {
    return c.json(
      {
        error: "Missing SMSGate credentials",
        code: "MISSING_SMSGATE_CREDENTIALS",
      },
      400,
    );
  }

  const error = await saveProfileFields(supabaseAdmin, user.id, {
    smsgate_base_url: baseUrl,
    smsgate_username: username,
    smsgate_password: password,
  });

  if (error) {
    return c.json(
      { error: extractErrorMessage(error), code: "SAVE_CREDENTIALS_FAILED" },
      500,
    );
  }

  return c.json({ success: true });
});

app.post(
  "/providers/simple-sms-gateway",
  authMiddleware,
  async (c: Context) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const payload = (await c.req.json().catch(() => ({}))) as {
      baseUrl?: string;
    };

    const supabaseAdmin = createSupabaseAdmin();
    const existingConfig = await getUserSmsProviderConfig(
      supabaseAdmin,
      user.id,
    );

    const baseUrl =
      payload.baseUrl?.trim() ||
      existingConfig.simple_sms_gateway_base_url ||
      "http://192.168.1.100:8080/send-sms";

    if (!baseUrl) {
      return c.json(
        {
          error: "Missing simple-sms-gateway endpoint",
          code: "MISSING_SIMPLE_SMS_GATEWAY_ENDPOINT",
        },
        400,
      );
    }

    const error = await saveProfileFields(supabaseAdmin, user.id, {
      simple_sms_gateway_base_url: baseUrl,
    });

    if (error) {
      return c.json(
        { error: extractErrorMessage(error), code: "SAVE_CREDENTIALS_FAILED" },
        500,
      );
    }

    return c.json({ success: true });
  },
);

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

function toTemplateValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => toTemplateValue(item))
      .filter((item) => item.length > 0)
      .join(", ");
  }
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function renderSmsTemplate(
  template: string,
  context: SmsTemplateContext,
): string {
  return template.replace(
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g,
    (_match, key: string) => {
      return toTemplateValue(context[key]);
    },
  );
}

function buildSmsTemplateContext(
  personalization: Record<string, unknown> | null,
): SmsTemplateContext {
  const source = personalization || {};
  const email = toTemplateValue(source.email);

  const givenName = toTemplateValue(source.givenName ?? source.given_name);
  const familyName = toTemplateValue(source.familyName ?? source.family_name);
  const fullName = toTemplateValue(source.fullName ?? source.name);

  const context: SmsTemplateContext = {
    name: toTemplateValue(source.name),
    fullName,
    givenName,
    familyName,
    email,
    emailDomain: email.includes("@") ? email.split("@")[1] : "",
    location: toTemplateValue(source.location),
    worksFor: toTemplateValue(source.worksFor ?? source.works_for),
    jobTitle: toTemplateValue(source.jobTitle ?? source.job_title),
    alternateName: toTemplateValue(
      source.alternateName ?? source.alternate_name,
    ),
    telephone: toTemplateValue(source.telephone),
    seniority: toTemplateValue(source.seniority),
    recency: toTemplateValue(source.recency),
    occurrence: toTemplateValue(source.occurrence),
    conversations: toTemplateValue(source.conversations),
    repliedConversations: toTemplateValue(
      source.repliedConversations ?? source.replied_conversations,
    ),
    sender: toTemplateValue(source.sender),
    recipient: toTemplateValue(source.recipient),
  };

  return context;
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
  checkFailed?: boolean;
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
      checkFailed: true,
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
    const token = `s_${getUniqueShortToken(8)}`;
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
    let trackedUrl = buildSmsClickTrackingUrl(token);

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
    selectedRecipients,
    senderName,
    messageTemplate,
    footerTextTemplate,
    useShortLinks,
    provider,
    smsgateConfig,
    simpleSmsGatewayConfig,
    timezone,
  } = payload;

  if (!senderName || !messageTemplate) {
    return c.json(
      { error: "Missing required fields", code: "MISSING_REQUIRED_FIELDS" },
      400,
    );
  }

  const phonesFromRecipients = (selectedRecipients || []).map((r) => r.phone);
  const requestedPhones =
    phonesFromRecipients.length > 0
      ? phonesFromRecipients
      : selectedPhones || [];

  if (!requestedPhones || requestedPhones.length === 0) {
    return c.json(
      { error: "No recipients selected", code: "NO_RECIPIENTS" },
      400,
    );
  }

  const validPhones = requestedPhones
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
    await saveProfileFields(supabaseAdmin, user.id, {
      smsgate_base_url:
        smsgateConfig.baseUrl ||
        "https://api.sms-gate.app/3rdparty/v1/messages",
      smsgate_username: smsgateConfig.username,
      smsgate_password: smsgateConfig.password,
    });
  }

  if (simpleSmsGatewayConfig?.baseUrl) {
    await saveProfileFields(supabaseAdmin, user.id, {
      simple_sms_gateway_base_url:
        simpleSmsGatewayConfig.baseUrl || "http://192.168.1.100:8080/send-sms",
    });
  }

  const selectedProvider = provider || "smsgate";

  const profileConfig = await getUserSmsProviderConfig(supabaseAdmin, user.id);
  const smsgateCredentials =
    toSmsGateCredentials(profileConfig) ||
    (smsgateConfig?.username && smsgateConfig?.password
      ? {
          baseUrl:
            smsgateConfig.baseUrl ||
            "https://api.sms-gate.app/3rdparty/v1/messages",
          username: smsgateConfig.username,
          password: smsgateConfig.password,
        }
      : null);
  const simpleSmsGatewayCredentials =
    toSimpleSmsGatewayCredentials(profileConfig) ||
    (simpleSmsGatewayConfig?.baseUrl
      ? {
          baseUrl:
            simpleSmsGatewayConfig.baseUrl ||
            "http://192.168.1.100:8080/send-sms",
        }
      : null);

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

  if (
    selectedProvider === "simple-sms-gateway" &&
    !simpleSmsGatewayCredentials
  ) {
    return c.json(
      {
        error:
          "simple-sms-gateway is not configured. Please add your credentials.",
        code: "SIMPLE_SMS_GATEWAY_NOT_CONFIGURED",
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
    if (quotaCheck.checkFailed) {
      return c.json(
        {
          error: `Unable to verify SMS quota right now: ${quotaCheck.error}`,
          code: "QUOTA_CHECK_FAILED",
        },
        500,
      );
    }

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
      provider: selectedProvider,
      message_template: messageTemplate,
      footer_text_template: footerTextTemplate || null,
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
    let token = `s_${getUniqueShortToken(10)}`;
    while (usedUnsubscribeTokens.has(token)) {
      token = `s_${getUniqueShortToken(10)}`;
    }
    usedUnsubscribeTokens.add(token);
    return token;
  };

  const personalizationByPhone = new Map<string, Record<string, unknown>>();
  for (const recipient of selectedRecipients || []) {
    const normalizedPhone = normalizePhoneNumber(recipient.phone || "");
    if (!normalizedPhone) continue;
    if (
      !personalizationByPhone.has(normalizedPhone) &&
      recipient.personalization
    ) {
      personalizationByPhone.set(normalizedPhone, recipient.personalization);
    }
  }

  const recipientRecords = uniquePhones.map((phone) => ({
    campaign_id: campaign.id,
    phone,
    message: messageTemplate,
    personalization_data: personalizationByPhone.get(phone) || null,
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

  triggerSmsCampaignProcessorFromEdge().catch((error) => {
    logger.error("Failed to trigger SMS campaign processor", {
      error: error instanceof Error ? error.message : String(error),
      campaignId: campaign.id,
    });
    // Cron remains as fallback if immediate trigger fails.
  });

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
    messageTemplate,
    footerTextTemplate,
    useShortLinks,
    provider,
    smsgateConfig,
    simpleSmsGatewayConfig,
  } = payload;

  if (!senderName || !messageTemplate) {
    return c.json(
      { error: "Missing required fields", code: "MISSING_REQUIRED_FIELDS" },
      400,
    );
  }

  const selectedProvider = provider || "smsgate";
  const supabaseAdmin = createSupabaseAdmin();

  if (selectedProvider === "smsgate") {
    if (smsgateConfig?.username && smsgateConfig?.password) {
      await saveProfileFields(supabaseAdmin, user.id, {
        smsgate_base_url:
          smsgateConfig.baseUrl ||
          "https://api.sms-gate.app/3rdparty/v1/messages",
        smsgate_username: smsgateConfig.username,
        smsgate_password: smsgateConfig.password,
      });
    }

    const profileConfig = await getUserSmsProviderConfig(
      supabaseAdmin,
      user.id,
    );
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
  }

  if (selectedProvider === "simple-sms-gateway") {
    if (simpleSmsGatewayConfig?.baseUrl) {
      await saveProfileFields(supabaseAdmin, user.id, {
        simple_sms_gateway_base_url:
          simpleSmsGatewayConfig.baseUrl ||
          "http://192.168.1.100:8080/send-sms",
      });
    }

    const profileConfig = await getUserSmsProviderConfig(
      supabaseAdmin,
      user.id,
    );
    if (!toSimpleSmsGatewayCredentials(profileConfig)) {
      return c.json(
        {
          error:
            "simple-sms-gateway is not configured. Please add your credentials.",
          code: "SIMPLE_SMS_GATEWAY_NOT_CONFIGURED",
        },
        400,
      );
    }
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

  const unsubscribeToken = `s_${getUniqueShortToken(10)}`;
  const unsubscribeUrl = buildSmsUnsubscribeUrl(unsubscribeToken);
  const renderedFooter = renderSmsTemplate(
    footerTextTemplate || "Unsubscribe me: {{unsubscribeUrl}}",
    { unsubscribeUrl },
  );

  let previewMessage = messageTemplate;
  if (renderedFooter.trim().length > 0) {
    previewMessage += `\n\n${renderedFooter}`;
  }
  if (useShortLinks) {
    const hrefRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = [...previewMessage.matchAll(hrefRegex)];

    for (const match of matches) {
      const originalUrl = match[1];
      if (!originalUrl) continue;

      const tempToken = `s_${getUniqueShortToken(10)}`;
      const trackedUrl = buildSmsClickTrackingUrl(tempToken);
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

  const campaignOwner = Array.isArray(recipient?.campaign)
    ? recipient?.campaign[0]
    : recipient?.campaign;

  if (error || !recipient || !campaignOwner?.user_id || !recipient.phone) {
    return c.html(
      "<html><body><h1>Invalid unsubscribe link</h1></body></html>",
    );
  }

  const userId = campaignOwner.user_id as string;
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

  const selectedProvider = campaign.provider as
    | "smsgate"
    | "simple-sms-gateway"
    | "twilio";
  let smsProvider;

  if (selectedProvider === "twilio") {
    smsProvider = createSmsProvider("twilio");
  } else if (selectedProvider === "simple-sms-gateway") {
    const profileConfig = await getUserSmsProviderConfig(
      supabaseAdmin,
      campaign.user_id,
    );
    const simpleSmsGatewayCredentials =
      toSimpleSmsGatewayCredentials(profileConfig);
    if (!simpleSmsGatewayCredentials) {
      return c.json(
        {
          error: "simple-sms-gateway credentials missing for campaign owner",
          code: "SIMPLE_SMS_GATEWAY_NOT_CONFIGURED",
        },
        400,
      );
    }
    smsProvider = createSmsProvider("simple-sms-gateway", {
      simpleSmsGateway: simpleSmsGatewayCredentials,
    });
  } else {
    const profileConfig = await getUserSmsProviderConfig(
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
    smsProvider = createSmsProvider("smsgate", {
      smsgate: smsgateCredentials,
    });
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients || []) {
    try {
      const templateContext = buildSmsTemplateContext(
        recipient.personalization_data as Record<string, unknown> | null,
      );
      const renderedBody = renderSmsTemplate(
        campaign.message_template,
        templateContext,
      );

      let messageWithTrackers = await injectTrackers(
        supabaseAdmin,
        resolvedCampaignId,
        recipient.id,
        renderedBody,
        campaign.use_short_links,
      );

      const unsubscribeToken =
        recipient.unsubscribe_short_token || `s_${getUniqueShortToken(10)}`;
      if (!recipient.unsubscribe_short_token) {
        await supabaseAdmin
          .schema("private")
          .from("sms_campaign_recipients")
          .update({ unsubscribe_short_token: unsubscribeToken })
          .eq("id", recipient.id);
      }
      const unsubscribeUrl = buildSmsUnsubscribeUrl(unsubscribeToken);
      const footerTemplate =
        campaign.footer_text_template || "Unsubscribe me: {{unsubscribeUrl}}";
      const renderedFooter = renderSmsTemplate(footerTemplate, {
        ...templateContext,
        unsubscribeUrl,
      });
      if (renderedFooter.trim().length > 0) {
        messageWithTrackers += `\n\n${renderedFooter}`;
      }

      let result: SendSmsResult = await smsProvider.send({
        to: recipient.phone,
        from: "",
        body: messageWithTrackers,
      });

      const providerUsed = selectedProvider;

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
            provider_used: providerUsed,
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
