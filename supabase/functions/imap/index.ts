import corsHeaders from "../_shared/cors.ts";
import Logger from "../_shared/logger.ts";
import { createSupabaseClient } from "../_shared/supabase-self-hosted.ts";
import IMAPSettingsDetector from "npm:@ankaboot.io/imap-autoconfig";

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
 * Returns the user or a 401 Response if unauthorized.
 */
async function validateAuthAndGetUser(authorization: string | null) {
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
 * Extracts the email from request parameters.
 * Returns the email string or a 400 Response if missing.
 */
function extractEmailFromRequest(req: Request) {
  const email = new URL(req.url).searchParams.get("email");
  return email && typeof email === "string"
    ? sanitizeImapInput(email)
    : new Response(null, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
}

/**
 * Handles incoming requests, ensuring authentication and processing IMAP detection.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await validateAuthAndGetUser(req.headers.get("authorization"));

    if (user instanceof Response) return user;

    const email = extractEmailFromRequest(req);

    if (email instanceof Response) return email;

    const config = await new IMAPSettingsDetector.default().detect(email);

    return new Response(JSON.stringify(config), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    Logger.error(`Server error: ${(error as Error).message}`);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
