// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil(promise: Promise<any>): void };

import { Context, Hono } from "hono";
import corsHeaders from "../_shared/cors.ts";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { z } from "zod";
import { validationErrorBody } from "../_shared/validation.ts";

const logger = createLogger("whatsapp-campaigns-process");

let activeCampaignId: string | null = null;
let activeSentCount = 0;
let activeFailedCount = 0;

const functionName = "whatsapp-campaigns-process";
const app = new Hono().basePath(`/${functionName}`);

app.onError((err, c) => {
  logger.error("Unhandled whatsapp-campaigns-process error", {
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
const OPENWA_API_URL = Deno.env.get("OPENWA_API_URL") || "";
const OPENWA_API_KEY = Deno.env.get("OPENWA_API_KEY") || "";

type RecipientStatus = "pending" | "sent" | "failed" | "skipped";
type SessionStatus =
  | "CREATED"
  | "QR_READY"
  | "CONNECTED"
  | "DISCONNECTED"
  | "ERROR";

interface WhatsAppSession {
  id: string;
  user_id: string;
  session_name: string;
  status: SessionStatus;
  connected_phone?: string;
  fleet_order: number;
  is_active: boolean;
}

interface Campaign {
  id: string;
  user_id: string;
  status: string;
  message_template: string;
  footer_text_template: string | null;
  fleet_mode_enabled: boolean;
  started_at: string | null;
  recipient_count: number;
}

interface Recipient {
  id: string;
  campaign_id: string;
  phone: string;
  send_status: RecipientStatus;
  personalization_data: Record<string, unknown> | null;
  attempt_count: number;
}

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

function renderTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  return template.replace(
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g,
    (_match, key: string) => {
      return toTemplateValue(context[key]);
    },
  );
}

function buildTemplateContext(
  personalization: Record<string, unknown> | null,
): Record<string, unknown> {
  const source = personalization || {};
  const email = toTemplateValue(source.email);

  return {
    name: toTemplateValue(source.name),
    fullName: toTemplateValue(source.fullName ?? source.name),
    givenName: toTemplateValue(source.givenName ?? source.given_name),
    familyName: toTemplateValue(source.familyName ?? source.family_name),
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
}

function renderMessage(
  messageTemplate: string,
  footerTemplate: string | null,
  personalization: Record<string, unknown> | null,
): string {
  const context = buildTemplateContext(personalization);

  let body = renderTemplate(messageTemplate, context);

  if (footerTemplate?.trim()) {
    const renderedFooter = renderTemplate(footerTemplate, context);
    if (renderedFooter.trim().length > 0) {
      body += `\n\n${renderedFooter}`;
    }
  }

  return body;
}

async function openwaFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${OPENWA_API_URL.replace(/\/$/, "")}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "api-key": OPENWA_API_KEY,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`OpenWA API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

async function sendWhatsappMessage(
  sessionName: string,
  to: string,
  body: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const result = await openwaFetch<{ id: string; status: string }>(
      "/api/sendText",
      {
        method: "POST",
        body: JSON.stringify({
          session: sessionName,
          to,
          body,
          isGroup: false,
        }),
      },
    );

    return { success: true, messageId: result.id };
  } catch (err) {
    return { success: false, error: extractErrorMessage(err) };
  }
}

// ==========================================
// MAIN PROCESS ENDPOINT
// ==========================================

app.post("/process", authMiddleware, async (c: Context) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({
      campaignId: z.string().uuid("Invalid campaignId").optional(),
    })
    .strict()
    .safeParse(body);

  if (!parsed.success) {
    return c.json(validationErrorBody(parsed.error), 400);
  }
  const { campaignId } = parsed.data;

  logger.info("Processing WhatsApp campaign", { campaignId });

  const supabaseAdmin = createSupabaseAdmin();

  let campaignQuery = supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .select("*")
    .eq("channel", "whatsapp");

  if (campaignId) {
    campaignQuery = campaignQuery.eq("id", campaignId);
  } else {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    campaignQuery = campaignQuery
      .or(
        `status.eq.queued,and(status.eq.processing,started_at.lt.${tenMinutesAgo})`,
      )
      .order("created_at", { ascending: true })
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

  const resolvedCampaignId = campaign.id as string;

  if (campaign.status !== "queued" && campaign.status !== "processing") {
    return c.json(
      { error: "Campaign already processed", code: "INVALID_STATUS" },
      400,
    );
  }

  // Recover stale "processing" campaigns
  if (campaign.status === "processing") {
    const startedAt = campaign.started_at
      ? new Date(campaign.started_at)
      : null;
    const staleThresholdMs = 10 * 60 * 1000; // 10 minutes
    if (!startedAt || Date.now() - startedAt.getTime() > staleThresholdMs) {
      logger.info("Recovering stale processing campaign", {
        campaignId: resolvedCampaignId,
        startedAt: campaign.started_at,
      });
      await supabaseAdmin
        .schema("private")
        .from("sms_campaign_recipients")
        .update({ send_status: "pending", attempt_count: 0 })
        .eq("campaign_id", resolvedCampaignId)
        .eq("send_status", "pending");
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

  logger.info("Starting WhatsApp campaign processing", {
    campaignId: resolvedCampaignId,
    status: campaign.status,
    fleetMode: campaign.fleet_mode_enabled,
    recipientCount: campaign.recipient_count,
  });

  await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", resolvedCampaignId);

  activeCampaignId = resolvedCampaignId;
  activeSentCount = 0;
  activeFailedCount = 0;

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

      // Load session assignments for fleet mode
      let sessionAssignments = new Map<string, { id: string; name: string }>();

      let activeSessions: WhatsAppSession[] = [];

      if (isFleetMode) {
        const { data: assignments } = await supabaseAdmin
          .schema("private")
          .from("sms_campaign_recipient_gateways")
          .select("recipient_id, gateway_id, gateway_name")
          .eq("campaign_id", resolvedCampaignId);

        if (assignments) {
          const gatewayIds = assignments
            .map((a) => a.gateway_id)
            .filter((id): id is string => id !== null);

          const { data: sessions } = await supabaseAdmin
            .schema("private")
            .from("whatsapp_sessions")
            .select("id, user_id, session_name, status, fleet_order, is_active")
            .in("id", gatewayIds);

          activeSessions = (sessions || []) as WhatsAppSession[];

          for (const assignment of assignments) {
            if (assignment.recipient_id && assignment.gateway_id) {
              sessionAssignments.set(assignment.recipient_id, {
                id: assignment.gateway_id,
                name: assignment.gateway_name || "Unknown",
              });
            }
          }
        }
      } else {
        // Single session mode: get the selected session
        const { data: campaignRecord } = await supabaseAdmin
          .schema("private")
          .from("sms_campaigns")
          .select("selected_gateway_ids")
          .eq("id", resolvedCampaignId)
          .single();

        const sessionIds = campaignRecord?.selected_gateway_ids || [];
        if (sessionIds.length > 0) {
          const { data: sessions } = await supabaseAdmin
            .schema("private")
            .from("whatsapp_sessions")
            .select("id, user_id, session_name, status, fleet_order, is_active")
            .in("id", sessionIds);

          activeSessions = (sessions || []) as WhatsAppSession[];

          if (activeSessions.length > 0) {
            const session = activeSessions[0];
            for (const recipient of recipients || []) {
              sessionAssignments.set(recipient.id, {
                id: session.id,
                name: session.session_name,
              });
            }
          }
        }
      }

      // Verify sessions are still connected
      const connectedSessions = activeSessions.filter(
        (s) => s.status === "CONNECTED" && s.is_active,
      );

      if (connectedSessions.length === 0 && activeSessions.length > 0) {
        throw new Error("No active WhatsApp sessions available for sending");
      }

      const MAX_RETRIES = 2;
      const sessionFailureCount = new Map<string, number>();
      const failedSessions = new Set<string>();
      const MAX_CONSECUTIVE_FAILURES = 5;

      for (const recipient of recipients || []) {
        let currentAttempt = 0;
        let sendSuccess = false;
        let lastError: string | undefined;

        while (currentAttempt < MAX_RETRIES && !sendSuccess) {
          try {
            const sessionAssignment = sessionAssignments.get(recipient.id);
            let currentSession = sessionAssignment;

            // Fleet mode: try to find alternative if session failed
            if (
              isFleetMode &&
              currentSession &&
              failedSessions.has(currentSession.id)
            ) {
              const alternative = connectedSessions.find(
                (s) => s.id !== currentSession?.id && !failedSessions.has(s.id),
              );
              if (alternative) {
                currentSession = {
                  id: alternative.id,
                  name: alternative.session_name,
                };
                sessionAssignments.set(recipient.id, currentSession);

                await supabaseAdmin
                  .schema("private")
                  .from("sms_campaign_recipient_gateways")
                  .update({
                    gateway_id: alternative.id,
                    gateway_name: alternative.session_name,
                  })
                  .eq("campaign_id", resolvedCampaignId)
                  .eq("recipient_id", recipient.id);

                logger.info("Reassigned recipient to alternative session", {
                  recipientId: recipient.id,
                  newSessionId: alternative.id,
                });
              }
            }

            if (!currentSession) {
              throw new Error(
                "No WhatsApp session available for this recipient",
              );
            }

            const session = connectedSessions.find(
              (s) => s.id === currentSession?.id,
            );
            if (!session) {
              throw new Error("Session not found or not connected");
            }

            const messageBody = renderMessage(
              campaign.message_template,
              campaign.footer_text_template,
              recipient.personalization_data as Record<string, unknown> | null,
            );

            const result = await sendWhatsappMessage(
              session.session_name,
              recipient.phone,
              messageBody,
            );

            if (result.success) {
              await supabaseAdmin
                .schema("private")
                .from("sms_campaign_recipients")
                .update({
                  send_status: "sent",
                  provider_message_id: result.messageId,
                  provider_used: "openwa",
                  sent_at: new Date().toISOString(),
                })
                .eq("id", recipient.id);

              sentCount++;
              activeSentCount = sentCount;
              sendSuccess = true;

              // Update last_used_at for the session
              await supabaseAdmin
                .schema("private")
                .from("whatsapp_sessions")
                .update({ last_used_at: new Date().toISOString() })
                .eq("id", session.id);

              // Reset failure count on success
              sessionFailureCount.set(session.id, 0);
            } else {
              const errorMessage = result.error || "Unknown send error";

              // Categorize errors
              const isPermanentError =
                errorMessage.includes("401") ||
                errorMessage.includes("403") ||
                errorMessage.includes("authentication failed") ||
                errorMessage.includes("unauthorized");

              if (isPermanentError) {
                failedSessions.add(session.id);
                logger.error("Permanent session error, marking as failed", {
                  sessionId: session.id,
                  sessionName: session.session_name,
                  error: result.error,
                });
                lastError = `Permanent error: ${result.error}`;
              } else {
                const failures = (sessionFailureCount.get(session.id) || 0) + 1;
                sessionFailureCount.set(session.id, failures);

                if (
                  failures >= MAX_CONSECUTIVE_FAILURES &&
                  !failedSessions.has(session.id)
                ) {
                  failedSessions.add(session.id);
                  logger.warn("Session marked as failed", {
                    sessionId: session.id,
                    sessionName: session.session_name,
                    consecutiveFailures: failures,
                  });
                }

                lastError = result.error || "Unknown send error";
                currentAttempt++;

                // Exponential backoff
                if (currentAttempt < MAX_RETRIES) {
                  await new Promise((resolve) =>
                    setTimeout(resolve, Math.pow(2, currentAttempt) * 1000),
                  );
                }
              }
            }
          } catch (err) {
            lastError = extractErrorMessage(err);
            currentAttempt++;

            if (currentAttempt < MAX_RETRIES) {
              await new Promise((resolve) =>
                setTimeout(resolve, Math.pow(2, currentAttempt) * 1000),
              );
            }
          }
        }

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
      logger.error("WhatsApp campaign processing failed", {
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

      activeCampaignId = null;
    }

    if (processingError) {
      logger.error("WhatsApp campaign processing completed with error", {
        campaignId: resolvedCampaignId,
        error: processingError,
        sentCount,
        failedCount,
      });
    } else {
      logger.info("WhatsApp campaign processing completed", {
        campaignId: resolvedCampaignId,
        sentCount,
        failedCount,
      });
    }
  })();

  EdgeRuntime.waitUntil(processingPromise);

  return c.json({ accepted: true, campaignId: resolvedCampaignId }, 202);
});

// Save partial progress when worker shuts down
globalThis.addEventListener("beforeunload", (ev) => {
  if (!activeCampaignId) return;

  logger.warn(
    "Worker shutting down — saving partial WhatsApp campaign progress",
    {
      campaignId: activeCampaignId,
      sentCount: activeSentCount,
      failedCount: activeFailedCount,
    },
  );

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
    logger.info("Partial WhatsApp progress saved", {
      campaignId: activeCampaignId,
      sentCount: activeSentCount,
      failedCount: activeFailedCount,
    });
  });

  EdgeRuntime.waitUntil(updatePromise);
});

Deno.serve((req) => app.fetch(req));

export default app;
