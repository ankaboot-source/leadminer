// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil(promise: Promise<any>): void };

import { Context, Hono } from "hono";
import corsHeaders from "../_shared/cors.ts";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { resolveCampaignBaseUrlFromEnv } from "../_shared/url.ts";
import { generateShortToken } from "../_shared/short-token.ts";
import {
  createSmsProvider,
  type SimpleSmsGatewayCredentials,
  type SmsGateCredentials,
} from "../sms-campaigns/providers/mod.ts";
import type { SendSmsResult } from "../sms-campaigns/providers/types.ts";
import { shortenUrl } from "../sms-campaigns/utils/short-link.ts";

const logger = createLogger("sms-campaigns-process");

// Module-level state for beforeunload handler to save partial progress
let activeCampaignId: string | null = null;
let activeSentCount = 0;
let activeFailedCount = 0;

const functionName = "sms-campaigns-process";
const app = new Hono().basePath(`/${functionName}`);

app.onError((err, c) => {
  logger.error("Unhandled sms-campaigns-process error", {
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
const PUBLIC_CAMPAIGN_BASE_URL = resolveCampaignBaseUrlFromEnv((key) =>
  Deno.env.get(key),
);
const FRONTEND_HOST = Deno.env.get("FRONTEND_HOST") || "";

type RecipientStatus = "pending" | "sent" | "failed" | "skipped";

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
    return;
  }

  // Only service role is allowed for this processor function
  return c.json({ error: "Unauthorized" }, 401);
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

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    if (typeof e.msg === "string") return e.msg;
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }
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

// ==========================================
// MAIN PROCESS ENDPOINT
// ==========================================

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
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    campaignQuery = campaignQuery
      .or(
        `status.eq.queued,and(status.eq.processing,started_at.lt.${tenMinutesAgo})`,
      )
      .order("created_at", {
        ascending: true,
      })
      .limit(1);
  }

  const { data: campaignData, error: fetchError } = await campaignQuery;
  const campaign = Array.isArray(campaignData) ? campaignData[0] : campaignData;

  logger.info("Campaign query result", {
    campaignId: campaign?.id || campaignId,
    campaignStatus: campaign?.status,
    provider: campaign?.provider,
    fleetMode: campaign?.fleet_mode_enabled,
    fetchError: fetchError?.message,
  });

  if (!campaignId && !campaign && !fetchError) {
    return c.json({ success: true, processed: 0 });
  }

  if (fetchError || !campaign) {
    return c.json({ error: "Campaign not found", code: "NOT_FOUND" }, 404);
  }

  if (!isServiceRole && user && campaign.user_id !== user.id) {
    return c.json({ error: "Campaign not found", code: "NOT_FOUND" }, 404);
  }

  const resolvedCampaignId = campaign.id as string;

  if (campaign.status !== "queued" && campaign.status !== "processing") {
    return c.json(
      { error: "Campaign already processed", code: "INVALID_STATUS" },
      400,
    );
  }

  // Recover stale "processing" campaigns (e.g. from a crashed edge function)
  if (campaign.status === "processing") {
    const startedAt = campaign.started_at
      ? new Date(campaign.started_at)
      : null;
    const staleThresholdMs = 10 * 60 * 1000; // 10 minutes
    if (!startedAt || Date.now() - startedAt.getTime() > staleThresholdMs) {
      logger.info("Recovering stale processing campaign", {
        campaignId: resolvedCampaignId,
        startedAt: campaign.started_at,
        staleMinutes: startedAt
          ? (Date.now() - startedAt.getTime()) / 60000
          : null,
      });
      // Reset any recipients still in "pending" state (never attempted)
      await supabaseAdmin
        .schema("private")
        .from("sms_campaign_recipients")
        .update({ send_status: "pending", attempt_count: 0 })
        .eq("campaign_id", resolvedCampaignId)
        .eq("send_status", "pending");
      // Fall through to re-process the campaign
    } else {
      logger.warn("Campaign is already being processed", {
        campaignId: resolvedCampaignId,
        startedAt: campaign.started_at,
      });
      return c.json(
        {
          error: "Campaign is already being processed",
          code: "ALREADY_PROCESSING",
        },
        409,
      );
    }
  }

  logger.info("Starting SMS campaign processing", {
    campaignId: resolvedCampaignId,
    status: campaign.status,
    provider: campaign.provider,
    fleetMode: campaign.fleet_mode_enabled,
    recipientCount: campaign.recipient_count,
  });

  await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", resolvedCampaignId);

  // Set module-level state so beforeunload can save partial progress
  activeCampaignId = resolvedCampaignId;
  activeSentCount = 0;
  activeFailedCount = 0;

  // Process in background — return 202 immediately
  const processingPromise = (async () => {
    let sentCount = 0;
    let failedCount = 0;
    let processingError: string | undefined;

    try {
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

      let fleetGateways: SmsFleetGateway[] = [];

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
            .select(
              "id, name, provider, config, daily_limit, monthly_limit, is_active, sent_today",
            )
            .in("id", gatewayIds);

          fleetGateways = (gateways || []) as SmsFleetGateway[];

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

      if (selectedProvider === "fleet") {
        // Fleet mode creates providers per-recipient in the loop below;
        // no single provider needed here
        smsProvider = undefined;
      } else if (selectedProvider === "twilio") {
        smsProvider = createSmsProvider("twilio");
      } else if (selectedProvider === "simple-sms-gateway") {
        const profileConfig = await getUserSmsProviderConfig(
          supabaseAdmin,
          campaign.user_id,
        );
        const simpleSmsGatewayCredentials =
          toSimpleSmsGatewayCredentials(profileConfig);
        if (!simpleSmsGatewayCredentials) {
          throw new Error(
            "simple-sms-gateway credentials missing for campaign owner",
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
          throw new Error("SMSGate credentials missing for campaign owner");
        }
        smsProvider = createSmsProvider("smsgate", {
          smsgate: smsgateCredentials,
        });
      }

      // Provider cache for fleet mode to avoid recreating providers
      const providerCache = new Map<
        string,
        ReturnType<typeof createSmsProvider>
      >();

      // Track gateway failures for automatic failover
      const gatewayFailureCount = new Map<string, number>();
      const failedGateways = new Set<string>();
      const MAX_CONSECUTIVE_FAILURES = 5;
      const MAX_RETRIES = 2;

      // Use Case 2 Fix: Check quota limits before processing
      // Mark gateways as failed if they've exceeded their daily limit
      if (isFleetMode && fleetGateways && fleetGateways.length > 0) {
        for (const gateway of fleetGateways) {
          if (
            gateway.daily_limit > 0 &&
            gateway.sent_today >= gateway.daily_limit
          ) {
            failedGateways.add(gateway.id);
            logger.warn("Gateway quota exceeded, marking as unavailable", {
              gatewayId: gateway.id,
              gatewayName: gateway.name,
              dailyLimit: gateway.daily_limit,
              sentToday: gateway.sent_today,
            });
          }
        }
      }

      for (const recipient of recipients || []) {
        let currentAttempt = 0;
        let sendSuccess = false;
        let lastError: string | undefined;

        while (currentAttempt < MAX_RETRIES && !sendSuccess) {
          try {
            // For fleet mode, get the assigned gateway and create provider
            let currentProvider:
              | ReturnType<typeof createSmsProvider>
              | undefined = smsProvider;
            let providerUsed = selectedProvider;

            // Use Case 5 Fix: Track error types for differentiated handling
            let isPermanentError = false;
            let isRateLimitError = false;
            let shouldSkipRetry = false;

            if (isFleetMode) {
              const gateway = gatewayAssignments.get(recipient.id);

              // UseCase 3 Fix: Immediate reassignment if gateway already marked as failed
              // Don't waste retries on known-failed gateways
              if (gateway && failedGateways.has(gateway.id)) {
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
                      if (
                        config.baseUrl &&
                        config.username &&
                        config.password
                      ) {
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
                providerUsed = gateway.provider as
                  | "smsgate"
                  | "simple-sms-gateway";

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
                  `Failed to create provider for gateway ${
                    gateway?.name || "unknown"
                  }`,
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
              recipient.unsubscribe_short_token || getUniqueShortToken(10);
            if (!recipient.unsubscribe_short_token) {
              await supabaseAdmin
                .schema("private")
                .from("sms_campaign_recipients")
                .update({ unsubscribe_short_token: unsubscribeToken })
                .eq("id", recipient.id);
            }
            let unsubscribeUrl = buildSmsUnsubscribeUrl(unsubscribeToken);
            if (campaign.use_short_links) {
              const shortUnsubUrl = await shortenUrl(unsubscribeUrl);
              if (shortUnsubUrl) {
                unsubscribeUrl = shortUnsubUrl;
              }
            }
            const footerTemplate =
              campaign.footer_text_template ||
              "Unsubscribe me: {{unsubscribeUrl}}";
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
              activeSentCount = sentCount;
              sendSuccess = true;

              // Increment gateway sent counters for fleet mode
              if (isFleetMode) {
                const gateway = gatewayAssignments.get(recipient.id);
                if (gateway) {
                  // Use Case 8 Fix: Atomic increment with quota check
                  const success = await supabaseAdmin.rpc(
                    "increment_gateway_sent_count_atomic",
                    {
                      p_gateway_id: gateway.id,
                      p_count: 1,
                    },
                  );

                  if (!success) {
                    // Quota exceeded atomically - mark gateway as failed
                    failedGateways.add(gateway.id);
                    logger.error(
                      "Gateway quota exceeded during atomic increment",
                      {
                        gatewayId: gateway.id,
                        gatewayName: gateway.name,
                        recipientId: recipient.id,
                      },
                    );

                    // Find alternative gateway
                    const alternativeGateway = findAlternativeGateway(
                      recipient.id,
                      failedGateways,
                      fleetGateways,
                      gatewayAssignments,
                      gatewayFailureCount,
                    );

                    if (alternativeGateway) {
                      // Reassign and retry with alternative gateway
                      gatewayAssignments.set(recipient.id, alternativeGateway);

                      await supabaseAdmin
                        .schema("private")
                        .from("sms_campaign_recipient_gateways")
                        .update({
                          gateway_id: alternativeGateway.id,
                          gateway_name: alternativeGateway.name,
                          gateway_provider: alternativeGateway.provider,
                          reassigned_at: new Date().toISOString(),
                          original_gateway_id: gateway.id,
                        })
                        .eq("campaign_id", resolvedCampaignId)
                        .eq("recipient_id", recipient.id);

                      logger.info(
                        "Reassigned recipient to alternative gateway due to quota",
                        {
                          recipientId: recipient.id,
                          oldGatewayId: gateway.id,
                          newGatewayId: alternativeGateway.id,
                        },
                      );

                      // Continue with alternative gateway in next iteration
                      continue;
                    }

                    // No alternative available - mark recipient as failed
                    logger.error(
                      "No alternative gateway available after quota exceeded",
                      {
                        recipientId: recipient.id,
                        failedGatewayId: gateway.id,
                      },
                    );

                    await supabaseAdmin
                      .schema("private")
                      .from("sms_campaign_recipients")
                      .update({
                        send_status: "failed",
                        provider_error:
                          "Gateway quota exceeded, no alternative available",
                        attempt_count: recipient.attempt_count + 1,
                      })
                      .eq("id", recipient.id);
                    failedCount++;
                    activeFailedCount = failedCount;
                    continue; // Skip to next recipient
                  }

                  // Reset failure count on success
                  gatewayFailureCount.set(gateway.id, 0);
                }
              }
            } else {
              // Use Case 5 Fix: Categorize errors for differentiated handling
              const errorMessage =
                typeof result.error === "string"
                  ? result.error
                  : JSON.stringify(result.error);

              // Permanent errors - no retry, mark gateway failed immediately
              isPermanentError =
                errorMessage.includes("401") ||
                errorMessage.includes("403") ||
                errorMessage.includes("invalid_credentials") ||
                errorMessage.includes("authentication failed") ||
                errorMessage.includes("unauthorized");

              // Rate limit errors - longer backoff
              isRateLimitError =
                errorMessage.includes("429") ||
                errorMessage.includes("rate limit") ||
                errorMessage.includes("too many requests");

              // Track gateway failure
              if (isFleetMode) {
                const gateway = gatewayAssignments.get(recipient.id);
                if (gateway) {
                  if (isPermanentError) {
                    // Mark gateway as failed immediately, no retry
                    failedGateways.add(gateway.id);
                    logger.error("Permanent gateway error, marking as failed", {
                      gatewayId: gateway.id,
                      gatewayName: gateway.name,
                      error: result.error,
                      recipientId: recipient.id,
                    });
                    lastError = `Permanent error: ${result.error}`;
                    shouldSkipRetry = true;
                  } else {
                    const failures =
                      (gatewayFailureCount.get(gateway.id) || 0) + 1;
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
              }

              if (!shouldSkipRetry) {
                lastError = result.error || "Unknown send error";
                currentAttempt++;

                // Exponential backoff before retry
                // Use Case 5 Fix: Longer backoff for rate limit errors
                const backoffDelay = isRateLimitError
                  ? 10000
                  : Math.pow(2, currentAttempt) * 1000;
                if (currentAttempt < MAX_RETRIES) {
                  await new Promise((resolve) =>
                    setTimeout(resolve, backoffDelay),
                  );
                }
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
          activeFailedCount = failedCount;
        }
      }
    } catch (err) {
      processingError = extractErrorMessage(err);
      logger.error("SMS campaign processing failed", {
        campaignId: resolvedCampaignId,
        error: processingError,
      });
    } finally {
      const finalStatus = processingError ? "failed" : "completed";
      await supabaseAdmin
        .schema("private")
        .from("sms_campaigns")
        .update({
          status: finalStatus,
          sent_count: sentCount,
          failed_count: failedCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", resolvedCampaignId);

      // Clear module-level state
      activeCampaignId = null;
    }

    if (processingError) {
      logger.error("Campaign processing completed with error", {
        campaignId: resolvedCampaignId,
        error: processingError,
        sentCount,
        failedCount,
      });
    } else {
      logger.info("Campaign processing completed successfully", {
        campaignId: resolvedCampaignId,
        sentCount,
        failedCount,
      });
    }
  })();

  // Run processing in background, return immediately
  EdgeRuntime.waitUntil(processingPromise);

  return c.json({ accepted: true, campaignId: resolvedCampaignId }, 202);
});

// Save partial progress when the worker is being shut down (wall clock limit)
globalThis.addEventListener("beforeunload", (ev) => {
  if (!activeCampaignId) return;

  logger.warn("Worker shutting down — saving partial campaign progress", {
    campaignId: activeCampaignId,
    sentCount: activeSentCount,
    failedCount: activeFailedCount,
  });

  // Update campaign with partial counts but keep status as "processing"
  // so the cron job can pick it up and resume with remaining pending recipients
  const supabaseAdmin = createSupabaseAdmin();
  const updatePromise = Promise.resolve(
    supabaseAdmin
      .schema("private")
      .from("sms_campaigns")
      .update({
        sent_count: activeSentCount,
        failed_count: activeFailedCount,
      })
      .eq("id", activeCampaignId),
  ).then(() => {
    logger.info("Partial progress saved before shutdown", {
      campaignId: activeCampaignId,
      sentCount: activeSentCount,
      failedCount: activeFailedCount,
    });
  });

  // waitUntil keeps the worker alive long enough to complete this DB update
  EdgeRuntime.waitUntil(updatePromise);
});

Deno.serve((req) => app.fetch(req));

export default app;
