// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil(promise: Promise<any>): void };

import { Context, Hono } from "hono";
import corsHeaders from "../_shared/cors.ts";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { resolveCampaignBaseUrlFromEnv } from "../_shared/url.ts";
import { generateShortToken } from "../_shared/short-token.ts";
import { z } from "zod";
import { validationErrorBody } from "../_shared/validation.ts";
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
  provider: "smsgate" | "simple-sms-gateway" | "sms-gateway" | "twilio";
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
    const attemptStart = Date.now();
    logger.info("recordClickLink attempt", {
      campaignId,
      recipientId,
      attempt,
      url,
    });
    const { error } = await supabaseAdmin
      .schema("private")
      .from("sms_campaign_link_clicks")
      .insert({
        campaign_id: campaignId,
        recipient_id: recipientId,
        token,
        url,
      });
    logger.info("recordClickLink attempt done", {
      campaignId,
      recipientId,
      attempt,
      url,
      elapsedMs: Date.now() - attemptStart,
      hasError: !!error,
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

    logger.info("recordClickLink duplicate, retrying", {
      campaignId,
      recipientId,
      attempt,
      url,
    });
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
  const funcStart = Date.now();
  const hrefRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = [...message.matchAll(hrefRegex)];
  let updatedMessage = message;

  logger.info("injectTrackers start", {
    campaignId,
    recipientId,
    urlCount: matches.length,
    useShortLinks,
  });

  for (const match of matches) {
    const originalUrl = match[1];
    if (!originalUrl) continue;

    const urlStart = Date.now();
    logger.info("Tracking URL", {
      campaignId,
      recipientId,
      url: originalUrl,
    });
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
    logger.info("Tracking URL done", {
      campaignId,
      recipientId,
      url: originalUrl,
      trackedUrl,
      elapsedMs: Date.now() - urlStart,
    });
  }

  logger.info("injectTrackers done", {
    campaignId,
    recipientId,
    urlCount: matches.length,
    totalElapsedMs: Date.now() - funcStart,
  });

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

  const body = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({ campaignId: z.string().uuid("Invalid campaignId").optional() })
    .strict()
    .safeParse(body);
  if (!parsed.success) {
    return c.json(validationErrorBody(parsed.error), 400);
  }
  const { campaignId } = parsed.data;

  logger.info("Processing SMS campaign", {
    campaignId,
    userId: user?.id,
    viaServiceRole: isServiceRole,
  });

  // Use a dedicated HTTP client with keepAlive=false to avoid the
  // shared connection pool issue in the supabase edge runtime where
  // the default keep-alive connection gets stuck after a few requests
  // (the response is sent by Kong but never received by Deno's fetch,
  // leaving all subsequent requests on the same connection hanging).
  // We force a fresh connection per request by disabling keep-alive
  // on the HTTP client passed to the custom fetch wrapper.
  // deno-lint-ignore no-explicit-any
  const freshConnClient = Deno.createHttpClient({ keepAlive: false } as any);
  const supabaseAdmin = createSupabaseAdmin(undefined, undefined, {
    fetch: (input, init) => {
      // Add Connection: close header to force connection closure
      // after each request. This works around a Deno 2.x fetch bug
      // in the supabase edge runtime where the default keep-alive
      // connection gets stuck after the first few requests (response
      // is sent by Kong but never received by the Deno fetch
      // implementation).
      const newHeaders = new Headers(init?.headers);
      newHeaders.set("Connection", "close");
      return fetch(input, { ...init, headers: newHeaders });
    },
  });

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
    campaignId: campaign?.id || campaignId || null,
    campaignStatus: campaign?.status ?? null,
    provider: campaign?.provider ?? null,
    fleetMode: campaign?.fleet_mode_enabled ?? null,
    fetchError: fetchError?.message ?? null,
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
      // Check if any recipient has been attempted — if not, the worker was
      // killed before it could make any progress. Mark as failed instead
      // of recovering into an infinite reprocess loop.
      const { count: attemptedCount } = await supabaseAdmin
        .schema("private")
        .from("sms_campaign_recipients")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", resolvedCampaignId)
        .gt("attempt_count", 0);

      if ((attemptedCount ?? 0) === 0) {
        logger.error(
          "Stuck processing campaign — marking as failed (no progress made)",
          {
            campaignId: resolvedCampaignId,
            startedAt: campaign.started_at,
            staleMinutes: startedAt
              ? (Date.now() - startedAt.getTime()) / 60000
              : null,
          },
        );
        await supabaseAdmin
          .schema("private")
          .from("sms_campaigns")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            last_error: "Worker was killed before any recipient was attempted",
          })
          .eq("id", resolvedCampaignId);
        return c.json(
          {
            error:
              "Campaign failed — worker was killed before making any progress",
            code: "WORKER_KILLED_NO_PROGRESS",
          },
          200,
        );
      }

      logger.info("Recovering stale processing campaign (some progress made)", {
        campaignId: resolvedCampaignId,
        startedAt: campaign.started_at,
        staleMinutes: startedAt
          ? (Date.now() - startedAt.getTime()) / 60000
          : null,
        attemptedRecipients: attemptedCount,
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

  // Capture the wall-clock start time so the in-line checkWatchdog
  // calls and the in-loop watchdog can measure elapsed time.
  const processingStartTime = Date.now();

  // Set module-level state so beforeunload can save partial progress
  activeCampaignId = resolvedCampaignId;
  activeSentCount = 0;
  activeFailedCount = 0;

  // Process in background — return 202 immediately
  const processingPromise = (async () => {
    let sentCount = 0;
    let failedCount = 0;
    let processingError: string | undefined;

    // Hard-bailout watchdog for the pre-loop setup. If we reach a
    // checkpoint and the wall-clock has exceeded 120s, set the error
    // and return so the `finally` block writes a `failed` status.
    // The parallel setTimeout above (130s) is the backstop for the
    // case where the IIFE hangs BETWEEN checkpoints and never makes
    // progress at all.
    const checkWatchdog = (): boolean => {
      if (Date.now() - processingStartTime > 120_000) {
        processingError =
          "Worker hit in-line watchdog (120s) — likely hung in pre-loop setup";
        logger.error("In-line watchdog triggered (pre-loop)", {
          campaignId: resolvedCampaignId,
          elapsedMs: Date.now() - processingStartTime,
        });
        return true;
      }
      return false;
    };

    try {
      const { data: recipients } = await supabaseAdmin
        .schema("private")
        .from("sms_campaign_recipients")
        .select("*")
        .eq("campaign_id", resolvedCampaignId)
        .eq("send_status", "pending");

      logger.info("SMS processing: post-recipients-query", {
        elapsedMs: Date.now() - processingStartTime,
        recipientCount: recipients?.length ?? 0,
      });
      if (checkWatchdog()) return;

      const isFleetMode = campaign.fleet_mode_enabled === true;
      const selectedProvider = campaign.provider as
        "smsgate" | "simple-sms-gateway" | "sms-gateway" | "twilio" | "fleet";

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
        logger.info("SMS processing: before fleet recipient_gateways query", {
          elapsedMs: Date.now() - processingStartTime,
        });
        const { data: assignments } = await supabaseAdmin
          .schema("private")
          .from("sms_campaign_recipient_gateways")
          .select("recipient_id, gateway_id, gateway_name, gateway_provider")
          .eq("campaign_id", resolvedCampaignId);

        logger.info("SMS processing: post fleet recipient_gateways query", {
          elapsedMs: Date.now() - processingStartTime,
          assignmentCount: assignments?.length ?? 0,
        });

        if (assignments) {
          // Fetch gateway configs
          const gatewayIds = assignments
            .map((a) => a.gateway_id)
            .filter((id): id is string => id !== null);

          if (gatewayIds.length > 0) {
            logger.info("SMS processing: before fleet gateways query", {
              elapsedMs: Date.now() - processingStartTime,
              gatewayIdCount: gatewayIds.length,
            });
            const { data: gateways } = await supabaseAdmin
              .schema("private")
              .from("sms_fleet_gateways")
              .select(
                "id, name, provider, config, daily_limit, monthly_limit, is_active, sent_today",
              )
              .in("id", gatewayIds);

            logger.info("SMS processing: post fleet gateways query", {
              elapsedMs: Date.now() - processingStartTime,
              gatewayCount: gateways?.length ?? 0,
            });

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
          } else {
            logger.warn(
              "SMS processing: fleet mode but no gateway IDs in assignments",
              {
                elapsedMs: Date.now() - processingStartTime,
              },
            );
          }
        } else {
          logger.warn(
            "SMS processing: fleet mode but no assignments returned",
            {
              elapsedMs: Date.now() - processingStartTime,
            },
          );
        }
      }

      logger.info("SMS processing: post-fleet-gateway-queries", {
        elapsedMs: Date.now() - processingStartTime,
        isFleetMode,
        fleetGatewayCount: fleetGateways.length,
        assignmentCount: gatewayAssignments.size,
      });
      if (checkWatchdog()) return;

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
      } else if (selectedProvider === "sms-gateway") {
        const profileConfig = await getUserSmsProviderConfig(
          supabaseAdmin,
          campaign.user_id,
        );
        const smsGatewayBaseUrl =
          profileConfig.simple_sms_gateway_base_url?.trim() || "";
        if (!smsGatewayBaseUrl) {
          throw new Error("sms-gateway credentials missing for campaign owner");
        }
        smsProvider = createSmsProvider("sms-gateway", {
          smsGateway: { baseUrl: smsGatewayBaseUrl },
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

      logger.info("SMS processing: post-provider-setup", {
        elapsedMs: Date.now() - processingStartTime,
        selectedProvider,
      });
      if (checkWatchdog()) return;

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

      // Watchdog: Supabase Deno edge functions have a 150s wall-clock
      // limit. Bail out at 140s so the `finally` block (and `beforeunload`
      // handler) can write a clear `failed` status + `last_error` instead
      // of being killed mid-loop. `processingStartTime` is the top-level
      // one declared above the IIFE so both the parallel watchdog and
      // this in-loop check measure from the same starting point.
      const MAX_WALL_CLOCK_MS = 140_000;

      for (const [recipientIndex, recipient] of (recipients || []).entries()) {
        // Watchdog: if we're running long, bail out and let the cron
        // recover on the next tick instead of being killed silently.
        if (Date.now() - processingStartTime > MAX_WALL_CLOCK_MS) {
          processingError =
            "Worker hit wall-clock watchdog (140s) — deferring remaining recipients to next cron run";
          logger.error("Wall-clock watchdog triggered", {
            campaignId: resolvedCampaignId,
            elapsedMs: Date.now() - processingStartTime,
            processed: sentCount + failedCount,
            totalRecipients: (recipients || []).length,
          });
          break; // exits the for loop
        }

        const recipientLoopStart = Date.now();
        logger.info("Processing recipient", {
          campaignId: resolvedCampaignId,
          recipientId: recipient.id,
          phone: recipient.phone,
          index: recipientIndex,
          total: (recipients || []).length,
          elapsedMs: recipientLoopStart - processingStartTime,
        });

        let currentAttempt = 0;
        let sendSuccess = false;
        let lastError: string | undefined;

        while (currentAttempt < MAX_RETRIES && !sendSuccess) {
          try {
            // For fleet mode, get the assigned gateway and create provider
            let currentProvider:
              ReturnType<typeof createSmsProvider> | undefined = smsProvider;
            let providerUsed = selectedProvider;

            // Use Case 5 Fix: Track error types for differentiated handling
            let isPermanentError = false;
            let isRateLimitError = false;
            let shouldSkipRetry = false;

            if (isFleetMode) {
              const gateway = gatewayAssignments.get(recipient.id);
              logger.info("Fleet-mode gateway lookup", {
                campaignId: resolvedCampaignId,
                recipientId: recipient.id,
                gatewayId: gateway?.id,
                gatewayName: gateway?.name,
                gatewayProvider: gateway?.provider,
                markedAsFailed: gateway ? failedGateways.has(gateway.id) : null,
                attempt: currentAttempt,
              });

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
                    "smsgate" | "simple-sms-gateway" | "sms-gateway";
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
                    } else if (alternativeGateway.provider === "sms-gateway") {
                      const config = alternativeGateway.config;
                      if (config.simpleSmsGatewayBaseUrl) {
                        providerCache.set(
                          cacheKey,
                          createSmsProvider("sms-gateway", {
                            smsGateway: {
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
                  "smsgate" | "simple-sms-gateway" | "sms-gateway";

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
                  } else if (gateway.provider === "sms-gateway") {
                    const config = gateway.config;
                    if (config.simpleSmsGatewayBaseUrl) {
                      providerCache.set(
                        cacheKey,
                        createSmsProvider("sms-gateway", {
                          smsGateway: {
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
                logger.error("Fleet-mode provider creation failed", {
                  campaignId: resolvedCampaignId,
                  recipientId: recipient.id,
                  gatewayId: gateway?.id,
                  gatewayName: gateway?.name,
                  gatewayProvider: gateway?.provider,
                  providerCacheKeys: Array.from(providerCache.keys()),
                });
                throw new Error(
                  `Failed to create provider for gateway ${
                    gateway?.name || "unknown"
                  }`,
                );
              }
              logger.info("Fleet-mode provider ready", {
                campaignId: resolvedCampaignId,
                recipientId: recipient.id,
                gatewayId: gateway?.id,
                gatewayName: gateway?.name,
                gatewayProvider: gateway?.provider,
                providerName: currentProvider?.name,
              });
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

            const injectTrackersStart = Date.now();
            logger.info("Step: injectTrackers", {
              campaignId: resolvedCampaignId,
              recipientId: recipient.id,
            });
            let messageWithTrackers = await injectTrackers(
              supabaseAdmin,
              resolvedCampaignId,
              recipient.id,
              renderedBody,
              campaign.use_short_links,
            );
            logger.info("Step done: injectTrackers", {
              campaignId: resolvedCampaignId,
              recipientId: recipient.id,
              elapsedMs: Date.now() - injectTrackersStart,
            });

            const unsubscribeToken =
              recipient.unsubscribe_short_token || getUniqueShortToken(10);
            if (!recipient.unsubscribe_short_token) {
              const unsubTokenStart = Date.now();
              logger.info("Step: persist unsubscribe token", {
                campaignId: resolvedCampaignId,
                recipientId: recipient.id,
              });
              await supabaseAdmin
                .schema("private")
                .from("sms_campaign_recipients")
                .update({ unsubscribe_short_token: unsubscribeToken })
                .eq("id", recipient.id);
              logger.info("Step done: persist unsubscribe token", {
                campaignId: resolvedCampaignId,
                recipientId: recipient.id,
                elapsedMs: Date.now() - unsubTokenStart,
              });
            }
            let unsubscribeUrl = buildSmsUnsubscribeUrl(unsubscribeToken);
            if (campaign.use_short_links) {
              const shortenStart = Date.now();
              logger.info("Step: shorten unsubscribe URL", {
                campaignId: resolvedCampaignId,
                recipientId: recipient.id,
                url: unsubscribeUrl,
              });
              const shortUnsubUrl = await shortenUrl(unsubscribeUrl);
              logger.info("Step done: shorten unsubscribe URL", {
                campaignId: resolvedCampaignId,
                recipientId: recipient.id,
                url: unsubscribeUrl,
                shortUrl: shortUnsubUrl ?? null,
                elapsedMs: Date.now() - shortenStart,
              });
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

            logger.info("Calling provider.send", {
              campaignId: resolvedCampaignId,
              recipientId: recipient.id,
              phone: recipient.phone,
              provider: providerUsed,
              messageLength: messageWithTrackers.length,
            });
            const sendStart = Date.now();
            const result: SendSmsResult = await currentProvider.send({
              to: recipient.phone,
              from: "",
              body: messageWithTrackers,
            });
            logger.info("provider.send returned", {
              campaignId: resolvedCampaignId,
              recipientId: recipient.id,
              provider: providerUsed,
              success: result.success,
              elapsedMs: Date.now() - sendStart,
              messageId: result.messageId,
              error: result.success ? undefined : result.error,
            });

            if (result.success) {
              const sentStatusStart = Date.now();
              logger.info("Step: mark recipient sent", {
                campaignId: resolvedCampaignId,
                recipientId: recipient.id,
                provider: providerUsed,
                messageId: result.messageId,
              });
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
              logger.info("Step done: mark recipient sent", {
                campaignId: resolvedCampaignId,
                recipientId: recipient.id,
                elapsedMs: Date.now() - sentStatusStart,
              });
              sentCount++;
              activeSentCount = sentCount;
              sendSuccess = true;

              // Increment gateway sent counters for fleet mode
              if (isFleetMode) {
                const gateway = gatewayAssignments.get(recipient.id);
                if (gateway) {
                  const rpcStart = Date.now();
                  logger.info("Step: increment_gateway_sent_count_atomic", {
                    campaignId: resolvedCampaignId,
                    recipientId: recipient.id,
                    gatewayId: gateway.id,
                  });
                  // Use Case 8 Fix: Atomic increment with quota check
                  const success = await supabaseAdmin.rpc(
                    "increment_gateway_sent_count_atomic",
                    {
                      p_gateway_id: gateway.id,
                      p_count: 1,
                    },
                  );
                  logger.info(
                    "Step done: increment_gateway_sent_count_atomic",
                    {
                      campaignId: resolvedCampaignId,
                      recipientId: recipient.id,
                      gatewayId: gateway.id,
                      quotaOk: !!success,
                      elapsedMs: Date.now() - rpcStart,
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

              logger.warn("SMS provider returned failure", {
                campaignId: resolvedCampaignId,
                recipientId: recipient.id,
                recipientPhone: recipient.phone,
                provider: providerUsed,
                error: errorMessage,
                isPermanentError:
                  errorMessage.includes("401") ||
                  errorMessage.includes("403") ||
                  errorMessage.includes("invalid_credentials"),
                attempt: currentAttempt + 1,
              });

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
            const errorStack = err instanceof Error ? err.stack : String(err);
            logger.error("SMS send threw", {
              campaignId: resolvedCampaignId,
              recipientId: recipient.id,
              recipientPhone: recipient.phone,
              attempt: currentAttempt + 1,
              provider: selectedProvider,
              error: lastError,
              stack: errorStack,
            });
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
          const failedStatusStart = Date.now();
          logger.info("Step: mark recipient failed (retries exhausted)", {
            campaignId: resolvedCampaignId,
            recipientId: recipient.id,
            lastError,
          });
          await supabaseAdmin
            .schema("private")
            .from("sms_campaign_recipients")
            .update({
              send_status: "failed",
              provider_error: lastError,
              attempt_count: recipient.attempt_count + MAX_RETRIES,
            })
            .eq("id", recipient.id);
          logger.info("Step done: mark recipient failed (retries exhausted)", {
            campaignId: resolvedCampaignId,
            recipientId: recipient.id,
            elapsedMs: Date.now() - failedStatusStart,
          });
          failedCount++;
          activeFailedCount = failedCount;
        }

        logger.info("Recipient loop iteration done", {
          campaignId: resolvedCampaignId,
          recipientId: recipient.id,
          sendSuccess,
          totalElapsedMs: Date.now() - recipientLoopStart,
        });
      }
    } catch (err) {
      processingError = extractErrorMessage(err);
      logger.error("SMS campaign processing failed", {
        campaignId: resolvedCampaignId,
        error: processingError,
      });
    } finally {
      const finalStatus = processingError ? "failed" : "completed";
      const finalUpdate: Record<string, unknown> = {
        status: finalStatus,
        sent_count: sentCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString(),
      };
      if (processingError) {
        finalUpdate.last_error = processingError;
      }
      await supabaseAdmin
        .schema("private")
        .from("sms_campaigns")
        .update(finalUpdate)
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

// Save partial progress when the worker is being shut down (wall clock limit).
// Marks the campaign as `failed` with a `last_error` so the frontend no
// longer shows it as stuck on "processing". The `.eq("status", "processing")`
// guard makes this idempotent: if the `finally` block already ran and set
// status to `completed`/`failed`, the `beforeunload` won't overwrite it.
globalThis.addEventListener("beforeunload", (ev) => {
  if (!activeCampaignId) return;

  logger.warn("Worker shutting down — saving partial campaign progress", {
    campaignId: activeCampaignId,
    sentCount: activeSentCount,
    failedCount: activeFailedCount,
  });

  const supabaseAdmin = createSupabaseAdmin();
  const updatePromise = Promise.resolve(
    supabaseAdmin
      .schema("private")
      .from("sms_campaigns")
      .update({
        status: "failed",
        sent_count: activeSentCount,
        failed_count: activeFailedCount,
        completed_at: new Date().toISOString(),
        last_error: `Worker killed by wall-clock limit (sent=${activeSentCount}, failed=${activeFailedCount})`,
      })
      .eq("id", activeCampaignId)
      .eq("status", "processing"), // only if not already updated by finally
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
