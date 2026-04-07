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
  type SimpleSmsGatewayCredentials,
  type SmsGateCredentials,
  TwilioProvider,
} from "./providers/mod.ts";
import type { SendSmsResult } from "./providers/types.ts";
import { getLocalTimeBounds, getSmsQuota } from "./utils/quota.ts";
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
  fleetMode?: boolean;
  selectedGatewayIds?: string[];
};

type SmsFleetGateway = {
  id: string;
  user_id: string;
  name: string;
  provider: "smsgate" | "simple-sms-gateway" | "twilio";
  config: {
    baseUrl?: string;
    username?: string;
    password?: string;
    simpleSmsGatewayBaseUrl?: string;
  };
  is_active: boolean;
  daily_limit: number;
  monthly_limit: number;
  sent_today: number;
  sent_this_month: number;
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
  if (!Boolean(SUPABASE_URL) || !SUPABASE_SERVICE_ROLE_KEY) {
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
  const username = config.smsgate_username?.trim() || "";
  const password = config.smsgate_password?.trim() || "";
  if (!username || !password) {
    return null;
  }

  return {
    baseUrl:
      config.smsgate_base_url?.trim() ||
      "https://api.sms-gate.app/3rdparty/v1/messages",
    username,
    password,
  };
}

function toSimpleSmsGatewayCredentials(
  config: SmsProviderProfileConfig,
): SimpleSmsGatewayCredentials | null {
  const baseUrl = config.simple_sms_gateway_base_url?.trim() || "";
  if (!baseUrl) {
    return null;
  }

  return {
    baseUrl,
  };
}

app.get("/providers/status", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const supabaseAdmin = createSupabaseAdmin();
  const config = await getUserSmsProviderConfig(supabaseAdmin, user.id);

  return c.json({
    smsgateConfigured: Boolean(
      config.smsgate_username?.trim() && config.smsgate_password?.trim(),
    ),
    smsgateBaseUrl:
      config.smsgate_base_url ||
      "https://api.sms-gate.app/3rdparty/v1/messages",
    smsgateUsername: config.smsgate_username || "",
    simpleSmsGatewayConfigured: Boolean(
      config.simple_sms_gateway_base_url?.trim(),
    ),
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

async function getUserFleetGateways(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  gatewayIds?: string[],
): Promise<SmsFleetGateway[]> {
  let query = supabaseAdmin
    .schema("private")
    .from("sms_fleet_gateways")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (gatewayIds && gatewayIds.length > 0) {
    query = query.in("id", gatewayIds);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data as SmsFleetGateway[];
}

function distributeRecipientsToGateways(
  recipients: string[],
  gateways: SmsFleetGateway[],
): Map<string, SmsFleetGateway> {
  const assignments = new Map<string, SmsFleetGateway>();

  if (gateways.length === 0) {
    return assignments;
  }

  // Sort gateways by daily usage (ascending) to distribute load
  const sortedGateways = [...gateways].sort((a, b) => {
    const aUsage = a.daily_limit > 0 ? a.sent_today / a.daily_limit : 0;
    const bUsage = b.daily_limit > 0 ? b.sent_today / b.daily_limit : 0;
    return aUsage - bUsage;
  });

  let gatewayIndex = 0;

  for (const recipient of recipients) {
    // Find next available gateway with capacity
    let attempts = 0;
    let assigned = false;

    while (attempts < sortedGateways.length && !assigned) {
      const gateway = sortedGateways[gatewayIndex % sortedGateways.length];

      // Check if gateway has capacity (0 = unlimited)
      const hasCapacity =
        gateway.daily_limit === 0 || gateway.sent_today < gateway.daily_limit;

      if (hasCapacity) {
        assignments.set(recipient, gateway);
        gateway.sent_today++;
        assigned = true;
      }

      gatewayIndex++;
      attempts++;
    }

    // If no gateway has capacity, assign to first gateway anyway
    // (it will fail during processing but be tracked)
    if (!assigned) {
      assignments.set(recipient, sortedGateways[0]);
    }
  }

  return assignments;
}

function findAlternativeGateway(
  recipientId: string,
  failedGateways: Set<string>,
  gateways: SmsFleetGateway[],
  gatewayAssignments: Map<
    string,
    {
      id: string;
      name: string;
      provider: string;
      config: Record<string, string>;
    }
  >,
  gatewayFailureCount: Map<string, number>,
): {
  id: string;
  name: string;
  provider: string;
  config: Record<string, string>;
} | null {
  const currentGateway = gatewayAssignments.get(recipientId);

  // Find gateway with lowest failure count and available capacity
  const availableGateways = gateways.filter(
    (g) =>
      !failedGateways.has(g.id) &&
      g.is_active &&
      (g.daily_limit === 0 || g.sent_today < g.daily_limit) &&
      g.id !== currentGateway?.id,
  );

  if (availableGateways.length === 0) {
    return null;
  }

  // Sort by lowest failure count, then by lowest usage
  availableGateways.sort((a, b) => {
    const aFailures = gatewayFailureCount.get(a.id) || 0;
    const bFailures = gatewayFailureCount.get(b.id) || 0;

    if (aFailures !== bFailures) {
      return aFailures - bFailures;
    }

    const aUsage = a.daily_limit > 0 ? a.sent_today / a.daily_limit : 0;
    const bUsage = b.daily_limit > 0 ? b.sent_today / b.daily_limit : 0;
    return aUsage - bUsage;
  });

  return {
    id: availableGateways[0].id,
    name: availableGateways[0].name,
    provider: availableGateways[0].provider,
    config: availableGateways[0].config,
  };
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
    fleetMode,
    selectedGatewayIds,
  } = payload;

  const isFleetMode = fleetMode === true;

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

  // Handle Fleet Mode
  let fleetGateways: SmsFleetGateway[] = [];
  if (isFleetMode) {
    if (!selectedGatewayIds || selectedGatewayIds.length === 0) {
      return c.json(
        {
          error: "No gateways selected for fleet mode",
          code: "NO_GATEWAYS_SELECTED",
        },
        400,
      );
    }

    fleetGateways = await getUserFleetGateways(
      supabaseAdmin,
      user.id,
      selectedGatewayIds,
    );

    if (fleetGateways.length === 0) {
      return c.json(
        {
          error: "Selected gateways not found or inactive",
          code: "GATEWAYS_NOT_FOUND",
        },
        400,
      );
    }
  }

  const selectedProvider = isFleetMode ? "fleet" : provider || "smsgate";
  const smsgateUsername = smsgateConfig?.username?.trim() || "";
  const smsgatePassword = smsgateConfig?.password?.trim() || "";
  const smsgateBaseUrl =
    smsgateConfig?.baseUrl?.trim() ||
    "https://api.sms-gate.app/3rdparty/v1/messages";
  const simpleSmsGatewayBaseUrl =
    simpleSmsGatewayConfig?.baseUrl?.trim() ||
    "http://192.168.1.100:8080/send-sms";

  // Only validate single provider config if not in fleet mode
  if (!isFleetMode) {
    if (selectedProvider === "smsgate") {
      const fields: Partial<SmsProviderProfileConfig> = {
        smsgate_base_url: smsgateBaseUrl,
      };
      if (smsgateUsername) {
        fields.smsgate_username = smsgateUsername;
      }
      if (smsgatePassword) {
        fields.smsgate_password = smsgatePassword;
      }
      await saveProfileFields(supabaseAdmin, user.id, fields);
    }

    if (selectedProvider === "simple-sms-gateway") {
      await saveProfileFields(supabaseAdmin, user.id, {
        simple_sms_gateway_base_url: simpleSmsGatewayBaseUrl,
      });
    }
  }

  const profileConfig = await getUserSmsProviderConfig(supabaseAdmin, user.id);
  const smsgateCredentials =
    toSmsGateCredentials(profileConfig) ||
    (smsgateUsername && smsgatePassword
      ? {
          baseUrl: smsgateBaseUrl,
          username: smsgateUsername,
          password: smsgatePassword,
        }
      : null);
  const simpleSmsGatewayCredentials =
    toSimpleSmsGatewayCredentials(profileConfig) ||
    (!isFleetMode && selectedProvider === "simple-sms-gateway"
      ? {
          baseUrl: simpleSmsGatewayBaseUrl,
        }
      : null);

  // Validate single provider configuration (only for non-fleet mode)
  if (!isFleetMode) {
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
      fleet_mode_enabled: isFleetMode,
      selected_gateway_ids: isFleetMode ? selectedGatewayIds : [],
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

  // Distribute recipients to gateways in fleet mode
  if (isFleetMode && fleetGateways.length > 0) {
    // Fetch the inserted recipients to get their IDs
    const { data: insertedRecipients } = await supabaseAdmin
      .schema("private")
      .from("sms_campaign_recipients")
      .select("id, phone")
      .eq("campaign_id", campaign.id);

    if (insertedRecipients) {
      const gatewayAssignments = distributeRecipientsToGateways(
        uniquePhones,
        fleetGateways,
      );

      const recipientGatewayRecords = [];
      for (const [phone, gateway] of gatewayAssignments.entries()) {
        const recipient = insertedRecipients.find((r) => r.phone === phone);
        if (recipient) {
          recipientGatewayRecords.push({
            campaign_id: campaign.id,
            recipient_id: recipient.id,
            gateway_id: gateway.id,
            gateway_name: gateway.name,
            gateway_provider: gateway.provider,
          });
        }
      }

      if (recipientGatewayRecords.length > 0) {
        const { error: assignmentError } = await supabaseAdmin
          .schema("private")
          .from("sms_campaign_recipient_gateways")
          .insert(recipientGatewayRecords);

        if (assignmentError) {
          logger.error("Failed to create gateway assignments", {
            error: assignmentError.message,
            campaignId: campaign.id,
          });
        }
      }
    }
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

  const smsgateUsername = smsgateConfig?.username?.trim() || "";
  const smsgatePassword = smsgateConfig?.password?.trim() || "";
  const smsgateBaseUrl =
    smsgateConfig?.baseUrl?.trim() ||
    "https://api.sms-gate.app/3rdparty/v1/messages";
  const simpleSmsGatewayBaseUrl =
    simpleSmsGatewayConfig?.baseUrl?.trim() ||
    "http://192.168.1.100:8080/send-sms";

  if (!senderName || !messageTemplate) {
    return c.json(
      { error: "Missing required fields", code: "MISSING_REQUIRED_FIELDS" },
      400,
    );
  }

  const selectedProvider = provider || "smsgate";
  const supabaseAdmin = createSupabaseAdmin();

  if (selectedProvider === "smsgate") {
    const fields: Partial<SmsProviderProfileConfig> = {
      smsgate_base_url: smsgateBaseUrl,
    };
    if (smsgateUsername) {
      fields.smsgate_username = smsgateUsername;
    }
    if (smsgatePassword) {
      fields.smsgate_password = smsgatePassword;
    }
    await saveProfileFields(supabaseAdmin, user.id, fields);

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
    await saveProfileFields(supabaseAdmin, user.id, {
      simple_sms_gateway_base_url: simpleSmsGatewayBaseUrl,
    });

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

  const isFleetMode = campaign.fleet_mode_enabled === true;
  const selectedProvider = campaign.provider as
    | "smsgate"
    | "simple-sms-gateway"
    | "twilio"
    | "fleet";

  // Load gateway assignments for fleet mode
  let gatewayAssignments: Map<
    string,
    {
      id: string;
      name: string;
      provider: string;
      config: Record<string, string>;
    }
  > = new Map();

  if (isFleetMode) {
    const { data: assignments } = await supabaseAdmin
      .schema("private")
      .from("sms_campaign_recipient_gateways")
      .select("recipient_id, gateway_id, gateway_name, gateway_provider")
      .eq("campaign_id", resolvedCampaignId);

    if (assignments) {
      // Fetch gateway configs
      const gatewayIds = assignments
        .map((a) => a.gateway_id)
        .filter((id): id is string => id !== null);

      const { data: gateways } = await supabaseAdmin
        .schema("private")
        .from("sms_fleet_gateways")
        .select("id, config")
        .in("id", gatewayIds);

      const gatewayConfigs = new Map(
        (gateways || []).map((g) => [g.id, g.config]),
      );

      for (const assignment of assignments) {
        if (assignment.recipient_id && assignment.gateway_id) {
          gatewayAssignments.set(assignment.recipient_id, {
            id: assignment.gateway_id,
            name: assignment.gateway_name || "Unknown",
            provider: assignment.gateway_provider || "smsgate",
            config: gatewayConfigs.get(assignment.gateway_id) || {},
          });
        }
      }
    }
  }
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

  // Provider cache for fleet mode to avoid recreating providers
  const providerCache = new Map<string, ReturnType<typeof createSmsProvider>>();

  // Track gateway failures for automatic failover
  const gatewayFailureCount = new Map<string, number>();
  const failedGateways = new Set<string>();
  const MAX_CONSECUTIVE_FAILURES = 5;
  const MAX_RETRIES = 2;

  for (const recipient of recipients || []) {
    let currentAttempt = 0;
    let sendSuccess = false;
    let lastError: string | undefined;

    while (currentAttempt < MAX_RETRIES && !sendSuccess) {
      try {
        // For fleet mode, get the assigned gateway and create provider
        let currentProvider: ReturnType<typeof createSmsProvider> | undefined =
          smsProvider;
        let providerUsed = selectedProvider;

        if (isFleetMode) {
          const gateway = gatewayAssignments.get(recipient.id);

          // Check if gateway is marked as failed and we should try reassignment
          if (gateway && failedGateways.has(gateway.id) && currentAttempt > 0) {
            // Try to find alternative gateway
            const alternativeGateway = findAlternativeGateway(
              recipient.id,
              failedGateways,
              fleetGateways,
              gatewayAssignments,
              gatewayFailureCount,
            );

            if (alternativeGateway) {
              // Update assignment
              gatewayAssignments.set(recipient.id, alternativeGateway);

              // Update database assignment
              await supabaseAdmin
                .schema("private")
                .from("sms_campaign_recipient_gateways")
                .update({
                  gateway_id: alternativeGateway.id,
                  gateway_name: alternativeGateway.name,
                  gateway_provider: alternativeGateway.provider,
                })
                .eq("campaign_id", resolvedCampaignId)
                .eq("recipient_id", recipient.id);

              logger.info("Reassigned recipient to alternative gateway", {
                recipientId: recipient.id,
                oldGatewayId: gateway.id,
                newGatewayId: alternativeGateway.id,
                attempt: currentAttempt,
              });

              // Update current gateway for provider creation
              providerUsed = alternativeGateway.provider as
                | "smsgate"
                | "simple-sms-gateway";
              const cacheKey = alternativeGateway.id;

              if (!providerCache.has(cacheKey)) {
                if (alternativeGateway.provider === "smsgate") {
                  const config = alternativeGateway.config;
                  if (config.baseUrl && config.username && config.password) {
                    providerCache.set(
                      cacheKey,
                      createSmsProvider("smsgate", {
                        smsgate: {
                          baseUrl: config.baseUrl,
                          username: config.username,
                          password: config.password,
                        },
                      }),
                    );
                  }
                } else if (
                  alternativeGateway.provider === "simple-sms-gateway"
                ) {
                  const config = alternativeGateway.config;
                  if (config.simpleSmsGatewayBaseUrl) {
                    providerCache.set(
                      cacheKey,
                      createSmsProvider("simple-sms-gateway", {
                        simpleSmsGateway: {
                          baseUrl: config.simpleSmsGatewayBaseUrl,
                        },
                      }),
                    );
                  }
                }
              }

              currentProvider = providerCache.get(cacheKey);
            }
          } else if (gateway) {
            providerUsed = gateway.provider as "smsgate" | "simple-sms-gateway";

            // Check cache for provider
            const cacheKey = `${gateway.id}`;
            if (!providerCache.has(cacheKey)) {
              if (gateway.provider === "smsgate") {
                const config = gateway.config;
                if (config.baseUrl && config.username && config.password) {
                  providerCache.set(
                    cacheKey,
                    createSmsProvider("smsgate", {
                      smsgate: {
                        baseUrl: config.baseUrl,
                        username: config.username,
                        password: config.password,
                      },
                    }),
                  );
                }
              } else if (gateway.provider === "simple-sms-gateway") {
                const config = gateway.config;
                if (config.simpleSmsGatewayBaseUrl) {
                  providerCache.set(
                    cacheKey,
                    createSmsProvider("simple-sms-gateway", {
                      simpleSmsGateway: {
                        baseUrl: config.simpleSmsGatewayBaseUrl,
                      },
                    }),
                  );
                }
              }
            }

            currentProvider = providerCache.get(cacheKey);
          }

          if (!currentProvider) {
            throw new Error(
              `Failed to create provider for gateway ${gateway?.name || "unknown"}`,
            );
          }
        }

        if (!currentProvider) {
          throw new Error("SMS provider not available");
        }

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

        const result: SendSmsResult = await currentProvider.send({
          to: recipient.phone,
          from: "",
          body: messageWithTrackers,
        });

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
          sendSuccess = true;

          // Increment gateway sent counters for fleet mode
          if (isFleetMode) {
            const gateway = gatewayAssignments.get(recipient.id);
            if (gateway) {
              await supabaseAdmin
                .schema("private")
                .rpc("increment_gateway_sent_count", {
                  p_gateway_id: gateway.id,
                  p_count: 1,
                });

              // Reset failure count on success
              gatewayFailureCount.set(gateway.id, 0);
            }
          }
        } else {
          // Track gateway failure
          if (isFleetMode) {
            const gateway = gatewayAssignments.get(recipient.id);
            if (gateway) {
              const failures = (gatewayFailureCount.get(gateway.id) || 0) + 1;
              gatewayFailureCount.set(gateway.id, failures);

              if (
                failures >= MAX_CONSECUTIVE_FAILURES &&
                !failedGateways.has(gateway.id)
              ) {
                failedGateways.add(gateway.id);
                logger.warn("Gateway marked as failed", {
                  gatewayId: gateway.id,
                  gatewayName: gateway.name,
                  consecutiveFailures: failures,
                });
              }
            }
          }

          lastError = result.error || "Unknown send error";
          currentAttempt++;

          // Exponential backoff before retry
          if (currentAttempt < MAX_RETRIES) {
            await new Promise((resolve) =>
              setTimeout(resolve, Math.pow(2, currentAttempt) * 1000),
            );
          }
        }
      } catch (err) {
        lastError = extractErrorMessage(err);
        currentAttempt++;

        // Exponential backoff before retry
        if (currentAttempt < MAX_RETRIES) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, currentAttempt) * 1000),
          );
        }
      }
    }

    // If all retries exhausted, mark as failed
    if (!sendSuccess) {
      await supabaseAdmin
        .schema("private")
        .from("sms_campaign_recipients")
        .update({
          send_status: "failed",
          provider_error: lastError,
          attempt_count: recipient.attempt_count + MAX_RETRIES,
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

// Fleet Gateway Management Endpoints

app.get("/fleet/gateways", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const supabaseAdmin = createSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .schema("private")
    .from("sms_fleet_gateways")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return c.json(
      { error: extractErrorMessage(error), code: "FETCH_FAILED" },
      500,
    );
  }

  return c.json({ gateways: data || [] });
});

app.post("/fleet/gateways", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const payload = (await c.req.json().catch(() => ({}))) as {
    name?: string;
    provider?: "smsgate" | "simple-sms-gateway" | "twilio";
    config?: Record<string, string>;
    daily_limit?: number;
    monthly_limit?: number;
  };

  if (!payload.name || !payload.provider) {
    return c.json(
      { error: "Missing required fields", code: "MISSING_REQUIRED_FIELDS" },
      400,
    );
  }

  const supabaseAdmin = createSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .schema("private")
    .from("sms_fleet_gateways")
    .insert({
      user_id: user.id,
      name: payload.name,
      provider: payload.provider,
      config: payload.config || {},
      daily_limit: payload.daily_limit ?? 0,
      monthly_limit: payload.monthly_limit ?? 0,
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) {
    return c.json(
      { error: extractErrorMessage(error), code: "CREATE_FAILED" },
      500,
    );
  }

  return c.json({ gateway: data });
});

app.put("/fleet/gateways/:id", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const gatewayId = c.req.param("id");
  const payload = (await c.req.json().catch(() => ({}))) as {
    name?: string;
    config?: Record<string, string>;
    daily_limit?: number;
    monthly_limit?: number;
    is_active?: boolean;
  };

  const supabaseAdmin = createSupabaseAdmin();

  // Verify ownership
  const { data: existing } = await supabaseAdmin
    .schema("private")
    .from("sms_fleet_gateways")
    .select("id")
    .eq("id", gatewayId)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return c.json({ error: "Gateway not found", code: "NOT_FOUND" }, 404);
  }

  const { error } = await supabaseAdmin
    .schema("private")
    .from("sms_fleet_gateways")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gatewayId);

  if (error) {
    return c.json(
      { error: extractErrorMessage(error), code: "UPDATE_FAILED" },
      500,
    );
  }

  return c.json({ success: true });
});

app.delete("/fleet/gateways/:id", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const gatewayId = c.req.param("id");
  const supabaseAdmin = createSupabaseAdmin();

  const { error } = await supabaseAdmin
    .schema("private")
    .from("sms_fleet_gateways")
    .delete()
    .eq("id", gatewayId)
    .eq("user_id", user.id);

  if (error) {
    return c.json(
      { error: extractErrorMessage(error), code: "DELETE_FAILED" },
      500,
    );
  }

  return c.json({ success: true });
});

app.post("/fleet/gateways/:id/test", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const gatewayId = c.req.param("id");
  const supabaseAdmin = createSupabaseAdmin();

  // Get gateway details
  const { data: gateway, error: fetchError } = await supabaseAdmin
    .schema("private")
    .from("sms_fleet_gateways")
    .select("*")
    .eq("id", gatewayId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !gateway) {
    return c.json({ error: "Gateway not found", code: "NOT_FOUND" }, 404);
  }

  // Test the gateway connection
  try {
    let testResult: { success: boolean; message: string };

    if (gateway.provider === "smsgate") {
      const config = gateway.config as {
        baseUrl?: string;
        username?: string;
        password?: string;
      };
      if (!config.baseUrl || !config.username || !config.password) {
        testResult = { success: false, message: "Missing SMSGate credentials" };
      } else {
        // Simple connectivity test - try to reach the endpoint
        const response = await fetch(config.baseUrl, {
          method: "HEAD",
        }).catch(() => null);
        testResult = response
          ? { success: true, message: "Gateway is reachable" }
          : { success: false, message: "Gateway is not reachable" };
      }
    } else if (gateway.provider === "simple-sms-gateway") {
      const config = gateway.config as { simpleSmsGatewayBaseUrl?: string };
      if (!config.simpleSmsGatewayBaseUrl) {
        testResult = { success: false, message: "Missing gateway URL" };
      } else {
        const response = await fetch(config.simpleSmsGatewayBaseUrl, {
          method: "HEAD",
        }).catch(() => null);
        testResult = response
          ? { success: true, message: "Gateway is reachable" }
          : { success: false, message: "Gateway is not reachable" };
      }
    } else {
      testResult = { success: false, message: "Unsupported provider" };
    }

    return c.json(testResult);
  } catch (error) {
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Test failed",
      },
      500,
    );
  }
});

Deno.serve((req) => app.fetch(req));

export default app;
