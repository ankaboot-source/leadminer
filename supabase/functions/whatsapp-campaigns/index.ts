// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil(promise: Promise<any>): void };

import { z } from "zod";
import { validationErrorBody } from "../_shared/validation.ts";
import { Context, Hono } from "hono";
import corsHeaders from "../_shared/cors.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
} from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { generateShortToken } from "../_shared/short-token.ts";
import {
  isValidPhoneNumber,
  normalizePhoneNumber,
} from "../sms-campaigns/utils/phone.ts";

const logger = createLogger("whatsapp-campaigns");

const functionName = "whatsapp-campaigns";
const app = new Hono().basePath(`/${functionName}`);

app.onError((err, c) => {
  logger.error("Unhandled whatsapp-campaigns error", {
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
  qr_code?: string;
  fleet_order: number;
  is_active: boolean;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

const whatsappCampaignCreateSchema = z.object({
  selectedPhones: z.array(z.string()).optional(),
  selectedRecipients: z
    .array(
      z.object({
        phone: z.string(),
        personalization: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
  senderName: z.string().min(1),
  messageTemplate: z.string().min(1),
  footerTextTemplate: z.string().optional(),
  sessionId: z.string().uuid().optional(),
  fleetMode: z.boolean().optional(),
});

const whatsappCampaignPreviewSchema = whatsappCampaignCreateSchema.extend({
  testPhoneNumber: z.string().optional(),
});

const sessionCreateSchema = z.object({
  sessionName: z.string().min(1).max(50),
});

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

function getUniqueShortToken(length = 8): string {
  return generateShortToken(length);
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

// ==========================================
// OpenWA API Helpers
// ==========================================

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

// ==========================================
// Session Management Endpoints
// ==========================================

app.get("/sessions", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const supabaseAdmin = createSupabaseAdmin();

  // Return sessions from DB (single source of truth)
  const { data, error } = await supabaseAdmin
    .schema("private")
    .from("whatsapp_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("fleet_order", { ascending: true });

  if (error) {
    return c.json(
      { error: extractErrorMessage(error), code: "FETCH_FAILED" },
      500,
    );
  }

  // Sync statuses from OpenWA
  const syncedSessions = await Promise.all(
    (data || []).map(async (session: WhatsAppSession) => {
      try {
        const openwaSession = await openwaFetch<{
          status: SessionStatus;
          qrCode?: string;
          connectedPhone?: string;
        }>(`/api/session/${session.session_name}`);

        if (
          openwaSession.status !== session.status ||
          openwaSession.qrCode !== session.qr_code
        ) {
          await supabaseAdmin
            .schema("private")
            .from("whatsapp_sessions")
            .update({
              status: openwaSession.status,
              qr_code: openwaSession.qrCode || null,
              connected_phone:
                openwaSession.connectedPhone || session.connected_phone,
              updated_at: new Date().toISOString(),
            })
            .eq("id", session.id);

          return {
            ...session,
            status: openwaSession.status,
            qr_code: openwaSession.qrCode,
            connected_phone:
              openwaSession.connectedPhone || session.connected_phone,
          };
        }
        return session;
      } catch (err) {
        logger.warn("Failed to sync session status", {
          sessionId: session.id,
          error: extractErrorMessage(err),
        });
        return session;
      }
    }),
  );

  return c.json({ sessions: syncedSessions });
});

app.post("/sessions", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const parseResult = sessionCreateSchema.safeParse(
    await c.req.json().catch(() => ({})),
  );
  if (!parseResult.success) {
    return c.json(validationErrorBody(parseResult.error), 400);
  }

  const { sessionName } = parseResult.data;
  const supabaseAdmin = createSupabaseAdmin();

  // Check max sessions per user (5)
  const { count, error: countError } = await supabaseAdmin
    .schema("private")
    .from("whatsapp_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    return c.json({ error: "Failed to check session limit" }, 500);
  }

  if ((count || 0) >= 5) {
    return c.json(
      {
        error: "Maximum 5 WhatsApp sessions allowed",
        code: "SESSION_LIMIT_EXCEEDED",
      },
      400,
    );
  }

  // Create session in OpenWA
  try {
    const openwaSession = await openwaFetch<{
      id: string;
      status: SessionStatus;
    }>("/api/session/start", {
      method: "POST",
      body: JSON.stringify({ name: sessionName }),
    });

    const { data, error } = await supabaseAdmin
      .schema("private")
      .from("whatsapp_sessions")
      .insert({
        user_id: user.id,
        session_name: sessionName,
        status: openwaSession.status || "CREATED",
      })
      .select()
      .single();

    if (error || !data) {
      // Rollback OpenWA session creation
      try {
        await openwaFetch(`/api/session/${sessionName}`, { method: "DELETE" });
      } catch (rollbackErr) {
        logger.error("Failed to rollback OpenWA session", {
          error: extractErrorMessage(rollbackErr),
        });
      }
      return c.json(
        { error: extractErrorMessage(error), code: "CREATE_FAILED" },
        500,
      );
    }

    return c.json({ session: data });
  } catch (err) {
    logger.error("Failed to create OpenWA session", {
      error: extractErrorMessage(err),
    });
    return c.json(
      {
        error: "Failed to create WhatsApp session",
        code: "OPENWA_ERROR",
        detail: extractErrorMessage(err),
      },
      500,
    );
  }
});

app.get("/sessions/:id", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const sessionId = c.req.param("id");
  const supabaseAdmin = createSupabaseAdmin();

  const { data: session, error } = await supabaseAdmin
    .schema("private")
    .from("whatsapp_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (error || !session) {
    return c.json({ error: "Session not found", code: "NOT_FOUND" }, 404);
  }

  // Sync status from OpenWA
  try {
    const openwaSession = await openwaFetch<{
      status: SessionStatus;
      qrCode?: string;
      connectedPhone?: string;
    }>(`/api/session/${session.session_name}`);

    if (openwaSession.status !== session.status || openwaSession.qrCode) {
      await supabaseAdmin
        .schema("private")
        .from("whatsapp_sessions")
        .update({
          status: openwaSession.status,
          qr_code: openwaSession.qrCode || null,
          connected_phone:
            openwaSession.connectedPhone || session.connected_phone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      return c.json({
        session: {
          ...session,
          status: openwaSession.status,
          qr_code: openwaSession.qrCode,
          connected_phone:
            openwaSession.connectedPhone || session.connected_phone,
        },
      });
    }
  } catch (err) {
    logger.warn("Failed to sync session status", {
      sessionId,
      error: extractErrorMessage(err),
    });
  }

  return c.json({ session });
});

app.delete("/sessions/:id", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const sessionId = c.req.param("id");
  const supabaseAdmin = createSupabaseAdmin();

  const { data: session, error: fetchError } = await supabaseAdmin
    .schema("private")
    .from("whatsapp_sessions")
    .select("session_name")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !session) {
    return c.json({ error: "Session not found", code: "NOT_FOUND" }, 404);
  }

  // Terminate in OpenWA
  try {
    await openwaFetch(`/api/session/${session.session_name}`, {
      method: "DELETE",
    });
  } catch (err) {
    logger.warn("Failed to terminate OpenWA session", {
      sessionName: session.session_name,
      error: extractErrorMessage(err),
    });
  }

  const { error } = await supabaseAdmin
    .schema("private")
    .from("whatsapp_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    return c.json(
      { error: extractErrorMessage(error), code: "DELETE_FAILED" },
      500,
    );
  }

  return c.json({ success: true });
});

app.post("/sessions/:id/qr", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const sessionId = c.req.param("id");
  const supabaseAdmin = createSupabaseAdmin();

  const { data: session, error: fetchError } = await supabaseAdmin
    .schema("private")
    .from("whatsapp_sessions")
    .select("session_name, status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !session) {
    return c.json({ error: "Session not found", code: "NOT_FOUND" }, 404);
  }

  if (session.status === "CONNECTED") {
    return c.json({
      status: session.status,
      message: "Session already connected",
    });
  }

  try {
    const qrData = await openwaFetch<{
      qrCode?: string;
      status: SessionStatus;
    }>(`/api/session/${session.session_name}/qr`);

    return c.json({
      status: qrData.status,
      qrCode: qrData.qrCode,
    });
  } catch (err) {
    return c.json(
      { error: "Failed to get QR code", detail: extractErrorMessage(err) },
      500,
    );
  }
});

// ==========================================
// Campaign Endpoints
// ==========================================

async function triggerWhatsappCampaignProcessor(campaignId?: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing required environment variables");
    return;
  }

  const body = campaignId ? { campaignId } : {};
  logger.info("Triggering WhatsApp campaign processor", { campaignId });

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/whatsapp-campaigns-process/process`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.error("WhatsApp campaign processor trigger failed", {
        status: response.status,
        body: text,
        campaignId,
      });
    }
  } catch (error) {
    logger.error("WhatsApp campaign processor trigger fetch error", {
      error: error instanceof Error ? error.message : String(error),
      campaignId,
    });
  }
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
  footerTemplate: string | undefined,
  personalization: Record<string, unknown> | null,
  _campaignId: string,
  _recipientId: string,
): { body: string } {
  const context = buildTemplateContext(personalization);

  let body = renderTemplate(messageTemplate, context);

  if (footerTemplate?.trim()) {
    const renderedFooter = renderTemplate(footerTemplate, context);
    if (renderedFooter.trim().length > 0) {
      body += `\n\n${renderedFooter}`;
    }
  }

  return { body };
}

app.post("/campaigns/create", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  logger.info("Creating WhatsApp campaign", { userId: user.id });

  const parseResult = whatsappCampaignCreateSchema.safeParse(
    await c.req.json().catch(() => ({})),
  );
  if (!parseResult.success) {
    return c.json(validationErrorBody(parseResult.error), 400);
  }
  const payload = parseResult.data;
  const {
    selectedPhones,
    selectedRecipients,
    senderName,
    messageTemplate,
    footerTextTemplate,
    sessionId,
    fleetMode,
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

  const supabaseAdmin = createSupabaseAdmin();

  // Validate sessions
  let selectedSession: WhatsAppSession | null = null;
  let activeSessions: WhatsAppSession[] = [];

  if (isFleetMode) {
    // Fleet mode: use all active connected sessions
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .schema("private")
      .from("whatsapp_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "CONNECTED")
      .eq("is_active", true)
      .order("fleet_order", { ascending: true });

    if (sessionsError || !sessions || sessions.length === 0) {
      return c.json(
        {
          error: "No active WhatsApp sessions available for fleet mode",
          code: "NO_SESSIONS",
        },
        400,
      );
    }

    activeSessions = sessions as WhatsAppSession[];
  } else {
    // Single session mode
    if (!sessionId) {
      return c.json(
        {
          error: "Session ID required for non-fleet mode",
          code: "SESSION_REQUIRED",
        },
        400,
      );
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .schema("private")
      .from("whatsapp_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .eq("status", "CONNECTED")
      .single();

    if (sessionError || !session) {
      return c.json(
        {
          error: "Selected session not found or not connected",
          code: "SESSION_NOT_FOUND",
        },
        400,
      );
    }

    selectedSession = session as WhatsAppSession;
  }

  // Create campaign
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .insert({
      user_id: user.id,
      sender_name: senderName,
      provider: "openwa",
      channel: "whatsapp",
      message_template: messageTemplate,
      footer_text_template: footerTextTemplate || null,
      recipient_count: uniquePhones.length,
      status: "queued",
      fleet_mode_enabled: isFleetMode,
      selected_gateway_ids: isFleetMode
        ? activeSessions.map((s) => s.id)
        : selectedSession
          ? [selectedSession.id]
          : [],
    })
    .select()
    .single();

  if (campaignError || !campaign) {
    logger.error("WhatsApp campaign insert failed", {
      userId: user.id,
      error: extractErrorMessage(campaignError),
    });
    return c.json(
      { error: extractErrorMessage(campaignError), code: "CREATE_FAILED" },
      500,
    );
  }

  // Insert recipients
  const usedUnsubscribeTokens = new Set<string>();
  const getNextUnsubscribeToken = () => {
    let token = getUniqueShortToken(10);
    while (usedUnsubscribeTokens.has(token)) {
      token = getUniqueShortToken(10);
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

  // Distribute recipients to sessions in fleet mode
  if (isFleetMode && activeSessions.length > 0) {
    const { data: insertedRecipients } = await supabaseAdmin
      .schema("private")
      .from("sms_campaign_recipients")
      .select("id, phone")
      .eq("campaign_id", campaign.id);

    if (insertedRecipients) {
      const sessionAssignments = new Map<string, string>(); // phone -> session_id
      for (let i = 0; i < uniquePhones.length; i++) {
        const session = activeSessions[i % activeSessions.length];
        sessionAssignments.set(uniquePhones[i], session.id);
      }

      const gatewayRecords = [];
      for (const [phone, sessionId] of sessionAssignments.entries()) {
        const recipient = insertedRecipients.find((r) => r.phone === phone);
        const session = activeSessions.find((s) => s.id === sessionId);
        if (recipient && session) {
          gatewayRecords.push({
            campaign_id: campaign.id,
            recipient_id: recipient.id,
            gateway_id: session.id,
            gateway_name: session.session_name,
            gateway_provider: "openwa",
          });
        }
      }

      if (gatewayRecords.length > 0) {
        const { error: assignmentError } = await supabaseAdmin
          .schema("private")
          .from("sms_campaign_recipient_gateways")
          .insert(gatewayRecords);

        if (assignmentError) {
          logger.error("Failed to create session assignments", {
            error: assignmentError.message,
            campaignId: campaign.id,
          });
        }
      }
    }
  }

  triggerWhatsappCampaignProcessor(campaign.id).catch((error) => {
    logger.error("Failed to trigger WhatsApp campaign processor", {
      error: error instanceof Error ? error.message : String(error),
      campaignId: campaign.id,
    });
  });

  return c.json({
    campaignId: campaign.id,
    recipientCount: uniquePhones.length,
  });
});

app.post("/campaigns/preview", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const parseResult = whatsappCampaignPreviewSchema.safeParse(
    await c.req.json().catch(() => ({})),
  );
  if (!parseResult.success) {
    return c.json(validationErrorBody(parseResult.error), 400);
  }
  const payload = parseResult.data;
  const {
    senderName,
    messageTemplate,
    footerTextTemplate,
    testPhoneNumber,
    sessionId,
    fleetMode,
  } = payload;

  if (!senderName || !messageTemplate) {
    return c.json(
      { error: "Missing required fields", code: "MISSING_REQUIRED_FIELDS" },
      400,
    );
  }

  const normalizedTestPhone = testPhoneNumber
    ? normalizePhoneNumber(testPhoneNumber)
    : null;
  if (testPhoneNumber && !normalizedTestPhone) {
    return c.json(
      { error: "Invalid phone number format", code: "INVALID_PHONE_NUMBER" },
      400,
    );
  }

  const supabaseAdmin = createSupabaseAdmin();

  // Validate session
  let selectedSession: WhatsAppSession | null = null;

  if (fleetMode) {
    const { data: sessions } = await supabaseAdmin
      .schema("private")
      .from("whatsapp_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "CONNECTED")
      .eq("is_active", true)
      .order("fleet_order", { ascending: true })
      .limit(1);

    if (!sessions || sessions.length === 0) {
      return c.json(
        { error: "No active WhatsApp sessions available", code: "NO_SESSIONS" },
        400,
      );
    }
    selectedSession = sessions[0] as WhatsAppSession;
  } else {
    if (!sessionId) {
      return c.json(
        { error: "Session ID required", code: "SESSION_REQUIRED" },
        400,
      );
    }

    const { data: session } = await supabaseAdmin
      .schema("private")
      .from("whatsapp_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .eq("status", "CONNECTED")
      .single();

    if (!session) {
      return c.json(
        {
          error: "Session not found or not connected",
          code: "SESSION_NOT_FOUND",
        },
        400,
      );
    }
    selectedSession = session as WhatsAppSession;
  }

  const preview = renderMessage(
    messageTemplate,
    footerTextTemplate,
    null,
    "preview",
    "preview",
  );

  // Send test message if phone provided
  if (normalizedTestPhone && selectedSession) {
    try {
      await openwaFetch("/api/sendText", {
        method: "POST",
        body: JSON.stringify({
          session: selectedSession.session_name,
          to: normalizedTestPhone,
          body: preview.body,
          isGroup: false,
        }),
      });

      return c.json({
        preview: preview.body,
        sentToPhone: normalizedTestPhone,
        sessionName: selectedSession.session_name,
      });
    } catch (err) {
      logger.error("Failed to send WhatsApp preview", {
        error: extractErrorMessage(err),
        phone: normalizedTestPhone,
      });
      return c.json(
        {
          error: "Failed to send preview message",
          code: "PREVIEW_SEND_FAILED",
          detail: extractErrorMessage(err),
        },
        500,
      );
    }
  }

  return c.json({
    preview: preview.body,
  });
});

app.get("/campaigns", authMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const supabaseAdmin = createSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .select("*")
    .eq("user_id", user.id)
    .eq("channel", "whatsapp")
    .order("created_at", { ascending: false });

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
    .eq("channel", "whatsapp")
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
    .eq("channel", "whatsapp")
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

app.post("/campaigns/:id/restart", authMiddleware, async (c: Context) => {
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
    .eq("channel", "whatsapp")
    .single();

  if (fetchError || !campaign) {
    return c.json({ error: "Campaign not found", code: "NOT_FOUND" }, 404);
  }

  if (campaign.status !== "cancelled" && campaign.status !== "failed") {
    return c.json(
      {
        error: "Cannot restart campaign in current status",
        code: "INVALID_STATUS",
      },
      400,
    );
  }

  await supabaseAdmin
    .schema("private")
    .from("sms_campaigns")
    .update({
      status: "queued",
      completed_at: null,
      started_at: null,
    })
    .eq("id", campaignId);

  await supabaseAdmin
    .schema("private")
    .from("sms_campaign_recipients")
    .update({ send_status: "pending" })
    .eq("campaign_id", campaignId)
    .in("send_status", ["skipped", "pending"]);

  triggerWhatsappCampaignProcessor(campaignId).catch((error: unknown) => {
    logger.error(
      "Failed to trigger WhatsApp campaign processor after restart",
      {
        error,
        campaignId,
      },
    );
  });

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
    .eq("user_id", user.id)
    .eq("channel", "whatsapp");

  if (error) {
    return c.json(
      { error: extractErrorMessage(error), code: "DELETE_FAILED" },
      500,
    );
  }

  return c.json({ success: true });
});

Deno.serve((req) => app.fetch(req));

export default app;
