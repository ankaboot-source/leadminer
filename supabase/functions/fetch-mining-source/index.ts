/**
 * INTERNAL SERVICE-TO-SERVICE FUNCTION
 *
 * This function returns sensitive credentials (OAuth tokens, passwords).
 * It should ONLY be called from trusted backend services (e.g., email-campaigns)
 * using the service role key via the x-service-key header.
 *
 * DO NOT expose this function to end users or untrusted clients.
 */
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import corsHeaders from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
} from "../_shared/supabase.ts";
import {
  isPermanentOAuthError,
  isTokenExpired,
  MiningSource,
  OAuthMiningSourceCredentials,
  refreshAccessToken,
} from "./oauth-handler/index.ts";
import { sendEmail } from "../_shared/mailing/email.ts";

const logger = createLogger("fetch-mining-source");

const RequestSchema = z.object({
  email: z.string().email().optional(),
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  refresh_email: z.string().email().optional(),
});

type RequestBody = z.infer<typeof RequestSchema>;

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function timingSafeCompare(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  return timingSafeEqual(aBytes, bBytes);
}

function isServiceKey(authHeader: string, serviceKey: string): boolean {
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;
  return timingSafeCompare(token, serviceKey);
}

class FetchMiningSourceHandler {
  private admin: ReturnType<typeof createSupabaseAdmin>;
  private encryptionKey: string;
  private serviceRoleKey: string;

  constructor() {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const encryptionKey = Deno.env.get("LEADMINER_API_HASH_SECRET");

    if (!supabaseUrl || !supabaseServiceRoleKey || !encryptionKey) {
      throw new Error("Missing required environment variables");
    }

    this.admin = createSupabaseAdmin(supabaseUrl, supabaseServiceRoleKey);
    this.encryptionKey = encryptionKey;
    this.serviceRoleKey = supabaseServiceRoleKey;
  }

  async handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const body = await FetchMiningSourceHandler.parseAndValidateBody(req);
      const authHeader = req.headers.get("Authorization");
      const userId = await this.resolveUserId(authHeader, body.user_id);

      logger.info("Fetching mining sources", { userId });

      let sources = await this.fetchSources(userId);
      sources = FetchMiningSourceHandler.filterByEmail(sources, body.email);
      sources = FetchMiningSourceHandler.filterById(sources, body.id);

      const refreshedEmails = await this.refreshTokensIfNeeded(
        sources,
        userId,
        body.refresh_email,
      );

      return FetchMiningSourceHandler.buildSuccessResponse(
        sources,
        refreshedEmails,
      );
    } catch (error) {
      return FetchMiningSourceHandler.handleError(error);
    }
  }

  private static async parseAndValidateBody(
    req: Request,
  ): Promise<RequestBody> {
    let rawBody: unknown;

    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError("Invalid request body: must be valid JSON");
    }

    const result = RequestSchema.safeParse(rawBody);

    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message).join("; ");
      throw new ValidationError(`Invalid request body: ${issues}`);
    }

    return result.data;
  }

  private async resolveUserId(
    authHeader: string | null,
    bodyUserId?: string,
  ): Promise<string> {
    if (!authHeader) {
      throw new AuthError("Missing Authorization header");
    }

    if (isServiceKey(authHeader, this.serviceRoleKey)) {
      if (!bodyUserId) {
        throw new ValidationError(
          "user_id is required when using service role key",
        );
      }
      logger.debug("Using service role authentication", { userId: bodyUserId });
      return bodyUserId;
    }

    const client = createSupabaseClient(authHeader);
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      throw new AuthError(error?.message || "Invalid or expired token");
    }

    logger.debug("Using user JWT authentication", { userId: user.id });
    return user.id;
  }

  private async fetchSources(userId: string): Promise<MiningSource[]> {
    const { data, error } = await this.admin
      .schema("private")
      .rpc("get_mining_source_credentials_for_user", {
        _user_id: userId,
        _encryption_key: this.encryptionKey,
      });

    if (error) {
      logger.error("Failed to fetch mining sources", {
        userId,
        error: error.message,
      });
      throw new Error(`Failed to fetch mining sources: ${error.message}`);
    }

    return (data ?? []) as MiningSource[];
  }

  private static filterById(
    sources: MiningSource[],
    idFilter?: string,
  ): MiningSource[] {
    if (!idFilter) {
      return sources;
    }

    return sources.filter((s) => s.id === idFilter);
  }

  private static filterByEmail(
    sources: MiningSource[],
    emailFilter?: string,
  ): MiningSource[] {
    if (!emailFilter) {
      return sources;
    }

    const normalizedFilter = emailFilter.toLowerCase();
    return sources.filter((s) => s.email.toLowerCase() === normalizedFilter);
  }

  private async refreshTokensIfNeeded(
    sources: MiningSource[],
    userId: string,
    forceRefreshEmail?: string,
  ): Promise<string[]> {
    const refreshedEmails: string[] = [];

    const forceRefreshSet = forceRefreshEmail
      ? new Set([forceRefreshEmail.toLowerCase()])
      : null;

    for (const source of sources) {
      if (source.type === "imap") continue;

      const credentials = source.credentials as OAuthMiningSourceCredentials;
      const shouldRefresh =
        forceRefreshSet?.has(source.email.toLowerCase()) ||
        isTokenExpired(credentials);

      if (!shouldRefresh) {
        continue;
      }

      logger.info("Token expired or forced refresh, attempting refresh", {
        email: source.email,
        userId,
        forced: !!forceRefreshSet?.has(source.email.toLowerCase()),
      });

      try {
        const refreshed = await refreshAccessToken(credentials);

        if (!refreshed.access_token || !refreshed.expires_at) {
          logger.warn("Token refresh returned incomplete data", {
            email: source.email,
          });
          continue;
        }

        const updatedCredentials = {
          ...credentials,
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token ?? credentials.refreshToken,
          expiresAt: refreshed.expires_at,
        };

        await this.admin.schema("private").rpc("upsert_mining_source", {
          _user_id: userId,
          _email: source.email,
          _type: source.type,
          _credentials: JSON.stringify(updatedCredentials),
          _encryption_key: this.encryptionKey,
        });

        source.credentials = updatedCredentials;
        refreshedEmails.push(source.email);

        logger.info("Token refreshed successfully", { email: source.email });

        // A successful refresh means the connection is healthy again; clear any
        // stale needs_reauth / failed-run flag set by an earlier rejection.
        if (source.config?.needs_reauth || source.config?.status) {
          const config = {
            ...(source.config ?? {}),
            needs_reauth: false,
            status: "idle",
            errors: [],
          };
          const { error: configError } = await this.admin
            .schema("private")
            .from("mining_sources")
            .update({ config })
            .eq("id", source.id);
          if (configError) {
            logger.error("Failed to clear needs_reauth flag", {
              email: source.email,
              error: configError.message,
            });
          }
        }
      } catch (error) {
        const permanent = isPermanentOAuthError(error);
        logger.error("Failed to refresh token", {
          email: source.email,
          userId,
          permanent,
          error: error instanceof Error ? error.message : String(error),
        });

        if (!permanent) {
          // Transient failure (network blip, token server hiccup, rate limit):
          // keep passive_mining enabled and surface the last-run error. It will
          // retry on the next schedule cycle.
          await this.recordError(source.id, source.email, error);
          continue;
        }

        // Permanent rejection (invalid_grant): the user revoked access or the
        // grant is dead. Mark the source as needing re-auth, stop continuous
        // mining so we don't hammer a dead source, and notify the user.
        await this.handlePermanentRejection(source, userId, error);
      }
    }

    return refreshedEmails;
  }

  private async handlePermanentRejection(
    source: MiningSource,
    userId: string,
    error: unknown,
  ): Promise<void> {
    if (!source.id) {
      logger.error(
        "Cannot flag source for re-auth: missing source id",
        { email: source.email },
      );
      return;
    }
    try {
      const config = { ...(source.config ?? {}), needs_reauth: true };
      await this.admin
        .schema("private")
        .from("mining_sources")
        .update({ config, passive_mining: false })
        .eq("id", source.id);
      logger.info("Disabled passive mining for permanently rejected source", {
        email: source.email,
        userId,
      });
    } catch (configError) {
      logger.error("Failed to flag source for re-auth", {
        email: source.email,
        error: configError instanceof Error ? configError.message : String(configError),
      });
    }

    const userEmail = await this.getUserEmail(userId);
    if (userEmail) {
      try {
        await sendEmail(
          userEmail,
          "Continuous mining paused: connection needs re-authentication",
          `<p>Your continuous mining for <strong>${this.escapeHtml(
            source.email,
          )}</strong> was paused because the connection was revoked or expired.</p>
          <p>Please reconnect this source to resume automatic mining.</p>`,
        );
        logger.info("Sent reconnect notification email", { userId });
      } catch (mailError) {
        logger.error("Failed to send reconnect notification", {
          email: source.email,
          error: mailError instanceof Error ? mailError.message : String(mailError),
        });
      }
    }
  }

  private async recordError(
    sourceId: string | undefined,
    email: string,
    error: unknown,
  ): Promise<void> {
    if (!sourceId) {
      logger.error("Cannot record transient refresh error: missing source id", {
        email,
      });
      return;
    }
    try {
      const existing = await this.admin
        .schema("private")
        .from("mining_sources")
        .select("config")
        .eq("id", sourceId)
        .single();
      const config = {
        ...((existing.data?.config as Record<string, unknown>) ?? {}),
        status: "failed",
        last_run: new Date().toISOString(),
        errors: [error instanceof Error ? error.message : String(error)],
      };
      await this.admin
        .schema("private")
        .from("mining_sources")
        .update({ config })
        .eq("id", sourceId);
    } catch (configError) {
      logger.error("Failed to record transient refresh error", {
        email,
        error: configError instanceof Error ? configError.message : String(configError),
      });
    }
  }

  private async getUserEmail(userId: string): Promise<string | null> {
    try {
      const { data } = await this.admin
        .schema("private")
        .from("profiles")
        .select("email")
        .eq("user_id", userId)
        .maybeSingle();
      return data?.email ?? null;
    } catch {
      return null;
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  private static buildSuccessResponse(
    sources: MiningSource[],
    refreshedEmails: string[],
  ): Response {
    const response = {
      sources: sources.map((s) => ({
        id: s.id,
        email: s.email,
        type: s.type,
        credentials: s.credentials,
      })),
      refreshed: refreshedEmails,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  private static handleError(error: unknown): Response {
    if (error instanceof AuthError) {
      logger.warn("Authentication failed", { error: error.message });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (error instanceof ValidationError) {
      logger.warn("Validation failed", { error: error.message });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    logger.error("Request failed", {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve((req: Request) => {
  const handler = new FetchMiningSourceHandler();
  return handler.handle(req);
});
