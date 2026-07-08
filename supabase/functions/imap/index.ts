import { Hono } from "hono";
import corsHeaders from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";
import { emailSchema } from "../_shared/validation.ts";
import IMAPSettingsDetector from "npm:@ankaboot.io/imap-autoconfig";
import { getRequiredEnv } from "../_shared/env-helpers.ts";

const logger = createLogger("imap");
const functionName = "imap";
const app = new Hono().basePath(`/${functionName}`);

const EMAILS_FETCHER_URL = getRequiredEnv("EMAILS_FETCHER_URL");

// CORS middleware
app.use("*", async (_c, next) => {
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    _c.res.headers.set(key, value);
  });
});
app.options("*", () => new Response("ok", { headers: corsHeaders }));

/**
 * Sanitizes input to prevent IMAP injection and CRLF attacks.
 * - Removes special IMAP characters: `{}`, `"`, `\`, `(`, `)`, `*`.
 * - Strips dangerous CRLF sequences.
 * - Strips leading and trailing whitespace.
 * @param input - The input string to sanitize.
 * @returns The sanitized string.
 */
export function sanitizeImapInput(input: string): string {
  if (typeof input !== "string") {
    throw new TypeError("Input must be a string");
  }
  // Remove CRLF characters to prevent injection
  const sanitized = input.replace(/[\r\n]+/g, "");
  // Escape trailing folder separator (if present)
  const cleaned = sanitized.replace(/\/$/, "");
  // Strip leading and trailing whitespace
  const trimmedInput = cleaned.trim();

  if (trimmedInput.length > 255) {
    // exceeds max length defined in RFC
    throw new Error("Max length exceeded");
  }
  return trimmedInput;
}

/**
 * Validates the authorization token and retrieves the authenticated user.
 * Returns the user or throws/returns a 401 Response.
 */
async function validateAuthAndGetUser(authorization: string | null | undefined) {
  const client = createSupabaseClient(authorization ?? "");
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) throw error;

  return (
    user ??
    new Response(null, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    })
  );
}

/**
 * POST /detect - Detects IMAP settings for the given email address.
 */
app.post("/detect", async (c) => {
  try {
    const user = await validateAuthAndGetUser(c.req.header("authorization"));

    if (user instanceof Response) return user;

    const email = c.req.query("email");
    const parsed = emailSchema.safeParse(email);

    if (!parsed.success) {
      return c.json({ error: "Invalid email" }, 400);
    }

    const sanitizedEmail = sanitizeImapInput(parsed.data);
    const config = await new IMAPSettingsDetector.default().detect(
      sanitizedEmail,
    );

    return c.json(config, 200);
  } catch (error) {
    logger.error(`Server error: ${(error as Error).message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * POST /boxes - Proxies to emails-fetcher microservice to list IMAP boxes.
 */
app.post("/boxes", async (c) => {
  try {
    const user = await validateAuthAndGetUser(c.req.header("authorization"));

    if (user instanceof Response) return user;

    const body = await c.req.json();
    const { mining_id, email } = body as {
      mining_id?: string;
      email?: string;
    };

    if (!mining_id || !email) {
      return c.json({ error: "mining_id and email are required" }, 400);
    }

    const response = await fetch(`${EMAILS_FETCHER_URL}/api/imap/boxes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, email }),
    });

    const data = await response.json();

    return c.json(data, response.status as 200);
  } catch (error) {
    logger.error(`Boxes endpoint error: ${(error as Error).message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

Deno.serve(app.fetch);
