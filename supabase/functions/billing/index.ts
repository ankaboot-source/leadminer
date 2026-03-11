import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { createLogger } from "../_shared/logger.ts";
import { handleCampaignCharge, handleCampaignQuota } from "./handlers/mod.ts";

const functionName = "billing";
const logger = createLogger("billing");

// ============================================================================
// Environment & Configuration
// ============================================================================

const getRequiredEnv = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const SERVICE_ROLE_KEY = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

// ============================================================================
// Authentication
// ============================================================================

const extractBearerToken = (header?: string): string | null => {
  if (!header) return null;

  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
};

const verifyServiceRole = (authHeader: string | undefined): boolean => {
  const token = extractBearerToken(authHeader);
  return token === SERVICE_ROLE_KEY;
};

// ============================================================================
// Middleware
// ============================================================================

async function authMiddleware(c: Context, next: () => Promise<void>) {
  const billingEnabled = Deno.env.get("ENABLE_CREDIT") === "true";
  if (!billingEnabled) {
    logger.debug("Billing disabled");
    return c.json({ error: "Billing not enabled" }, 404);
  }

  const authHeader = c.req.header("authorization");
  if (!verifyServiceRole(authHeader)) {
    logger.warn("Unauthorized billing request - invalid service role key");
    return c.json({ error: "Unauthorized", code: "INVALID_SERVICE_ROLE" }, 401);
  }

  return await next();
}

// ============================================================================
// App Setup
// ============================================================================

const app = new Hono().basePath(`/${functionName}`);

app.use("*", cors());

// Apply auth middleware to all billing routes
app.use("*", authMiddleware);

// ============================================================================
// Campaign Routes
// ============================================================================

// Charge credits for campaign (deducts immediately)
app.post("/campaign/charge", handleCampaignCharge);

// Check quota for campaign (validation only, no charge)
app.post("/campaign/quota", handleCampaignQuota);

// ============================================================================
// Future Feature Routes (placeholders for next billing types)
// ============================================================================

// Export billing (CSV/VCARD)
// app.post("/export/charge", handleExportCharge);
// app.post("/export/quota", handleExportQuota);

// Enrichment billing
// app.post("/enrichment/charge", handleEnrichmentCharge);
// app.post("/enrichment/quota", handleEnrichmentQuota);

// ============================================================================
// Error Handling
// ============================================================================

app.onError((err, c) => {
  logger.error("Unhandled billing function error", { error: err.message });
  return c.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    500,
  );
});

// ============================================================================
// Server
// ============================================================================

if (import.meta.main) {
  Deno.serve((req: Request) => app.fetch(req));
}

export { app };
