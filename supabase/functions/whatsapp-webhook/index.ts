import { Context, Hono } from "hono";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger("whatsapp-webhook");

const functionName = "whatsapp-webhook";
const app = new Hono().basePath(`/${functionName}`);

const WEBHOOK_SECRET = Deno.env.get("OPENWA_WEBHOOK_SECRET") || "";

app.onError((err, c) => {
  logger.error("Unhandled whatsapp-webhook error", {
    path: c.req.path,
    error: err.message,
  });
  return c.json({ error: "Internal server error" }, 500);
});

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }
  return "Unknown error";
}

// ==========================================
// Webhook Signature Verification
// ==========================================

async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!secret) return true; // Skip verification if no secret configured

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const expectedSig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signature === expectedHex;
}

// ==========================================
// Event handlers
// ==========================================

interface WebhookEvent {
  event?: string;
  session?: string;
  data?: Record<string, unknown>;
}

/**
 * Delivery/read receipt. Maps ack status: 1=sent, 2=delivered, 3=read.
 */
async function handleMessageAck(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  sessionName: string,
  eventData: Record<string, unknown>,
): Promise<{ error: string } | null> {
  const messageId = eventData.id as string | undefined;
  const ackStatus = eventData.ack as number | undefined;

  if (!messageId) {
    return { error: "Missing message ID" };
  }
  let status: string | null = null;
  let deliveredAt: string | null = null;
  let readAt: string | null = null;

  if (ackStatus === 2) {
    status = "delivered";
    deliveredAt = new Date().toISOString();
  } else if (ackStatus === 3) {
    status = "read";
    readAt = new Date().toISOString();
    // Also set delivered if not already set
    deliveredAt = deliveredAt || new Date().toISOString();
  } else if (ackStatus === 1) {
    status = "sent";
  }

  if (!status) return null;

  const updates: Record<string, unknown> = { ack_status: status };
  if (deliveredAt) updates.delivered_at = deliveredAt;
  if (readAt) updates.read_at = readAt;

  const { error } = await supabaseAdmin
    .schema("private")
    .from("sms_campaign_recipients")
    .update(updates)
    .eq("provider_message_id", messageId)
    .eq("provider_used", "openwa");

  if (error) {
    logger.error("Failed to update ack status", {
      messageId,
      error: extractErrorMessage(error),
    });
  } else {
    logger.info("Updated message ack status", {
      messageId,
      status,
      ackStatus,
    });
  }

  return null;
}

/**
 * QR code ready for a session.
 */
async function handleQr(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  sessionName: string,
  eventData: Record<string, unknown>,
): Promise<void> {
  const qrCode = eventData.qr as string | undefined;

  if (!sessionName || !qrCode) return;

  const { error } = await supabaseAdmin
    .schema("private")
    .from("whatsapp_sessions")
    .update({
      status: "QR_READY",
      qr_code: qrCode,
      updated_at: new Date().toISOString(),
    })
    .eq("session_name", sessionName);

  if (error) {
    logger.error("Failed to update QR status", {
      sessionName,
      error: extractErrorMessage(error),
    });
  } else {
    logger.info("Updated session QR code", { sessionName });
  }
}

/**
 * Session disconnected.
 */
async function handleDisconnected(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  sessionName: string,
): Promise<void> {
  if (!sessionName) return;

  const { error } = await supabaseAdmin
    .schema("private")
    .from("whatsapp_sessions")
    .update({
      status: "DISCONNECTED",
      updated_at: new Date().toISOString(),
    })
    .eq("session_name", sessionName);

  if (error) {
    logger.error("Failed to update disconnected status", {
      sessionName,
      error: extractErrorMessage(error),
    });
  } else {
    logger.info("Session disconnected", { sessionName });
  }
}

/**
 * Incoming message (not typically needed for campaigns).
 */
function handleIncomingMessage(
  sessionName: string,
  eventData: Record<string, unknown>,
): void {
  const body = eventData.body as string | undefined;

  logger.info("Received incoming message", {
    sessionName,
    bodyLength: body?.length ?? 0,
  });
}

// ==========================================
// Webhook Handler
// ==========================================

app.post("/webhook", async (c: Context) => {
  const payload = await c.req.text();
  const signature = c.req.header("x-webhook-signature") || "";

  if (WEBHOOK_SECRET) {
    const isValid = await verifyWebhookSignature(
      payload,
      signature,
      WEBHOOK_SECRET,
    );
    if (!isValid) {
      logger.warn("Invalid webhook signature");
      return c.json({ error: "Invalid signature" }, 401);
    }
  }

  let event: WebhookEvent;

  try {
    event = JSON.parse(payload);
  } catch {
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  const eventType = event.event || "";
  const sessionName = event.session || "";
  const eventData = event.data || {};

  logger.info("Received WhatsApp webhook", {
    eventType,
    sessionName,
  });

  const supabaseAdmin = createSupabaseAdmin();

  try {
    switch (eventType) {
      case "message.ack": {
        const result = await handleMessageAck(
          supabaseAdmin,
          sessionName,
          eventData,
        );
        if (result?.error) {
          return c.json({ error: result.error }, 400);
        }
        break;
      }

      case "qr":
        await handleQr(supabaseAdmin, sessionName, eventData);
        break;

      case "disconnected":
        await handleDisconnected(supabaseAdmin, sessionName);
        break;

      case "message":
        handleIncomingMessage(sessionName, eventData);
        break;

      default:
        logger.debug("Unhandled webhook event type", {
          eventType,
          sessionName,
        });
    }

    return c.json({ success: true });
  } catch (err) {
    logger.error("Webhook processing error", {
      error: extractErrorMessage(err),
      eventType,
      sessionName,
    });
    return c.json({ error: "Processing failed" }, 500);
  }
});

app.get("/health", (c) => c.json({ status: "ok", service: functionName }));

Deno.serve((req) => app.fetch(req));

export default app;
