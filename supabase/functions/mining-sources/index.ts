import { Context, Hono } from "hono";
import corsHeaders from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  getOptionalEnv,
  getRequiredEnv,
} from "../_shared/env-helpers.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
} from "../_shared/supabase.ts";
import { validationErrorResponse } from "../_shared/validation.ts";
import {
  createSchema,
  authorizeSchema,
  callbackQuerySchema,
  configureSourceSchema,
} from "./schemas.ts";
import {
  applySourceConfig,
  type ConfigureSourceParams,
} from "./config.ts";
import {
  getAuthClient,
  getTokenConfig,
  exchangeForToken,
  signOAuthState,
  parseOAuthState,
  getSafeRedirectPath,
  type OAuthMiningSourceProvider,
} from "./oauth/utils.ts";
import { SourceHealthState } from "../_shared/enums.ts";

const logger = createLogger("mining-sources");
const functionName = "mining-sources";
const app = new Hono().basePath(`/${functionName}`);

app.onError((err, c) => {
  logger.error("Unhandled mining-sources error", {
    path: c.req.path,
    method: c.req.method,
    error: err.message,
    stack: err.stack,
  });
  return c.json({ error: "Unexpected server error" }, 500);
});

// Resolved lazily (first request) instead of at import: import-time
// getRequiredEnv crashed the WHOLE function on deployments that legitimately
// omit a var (e.g. self-hosted single-provider setups without FRONTEND_HOST),
// breaking even routes that never need it. Required-for-all vars throw on
// first use with a clear message; FRONTEND_HOST / OAUTH_CALLBACK_BASE_URL
// degrade to empty so only the OAuth flows that need them fail.
let envCache: {
  serviceRoleKey: string;
  frontendHost: string;
  hashSecret: string;
  oauthCallbackBaseUrl: string;
} | undefined;

function envs() {
  if (!envCache) {
    envCache = {
      serviceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      frontendHost: getOptionalEnv("FRONTEND_HOST").replace(/\/$/, ""),
      hashSecret: getRequiredEnv("LEADMINER_API_HASH_SECRET"),
      oauthCallbackBaseUrl: getOptionalEnv("OAUTH_CALLBACK_BASE_URL").replace(
        /\/+$/,
        "",
      ),
    };
  }
  return envCache;
}

app.use("*", async (c, next) => {
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

app.options("*", () => new Response("ok", { headers: corsHeaders }));

async function authMiddleware(c: Context, next: () => Promise<void>) {
  const authHeader = c.req.header("authorization");
  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }
  if (authHeader === `Bearer ${envs().serviceRoleKey}`) {
    return await next();
  }
  const supabase = createSupabaseClient(authHeader);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", data.user);
  return next();
}

app.post("/", authMiddleware, async (c: Context) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, corsHeaders);
  }

  const user = c.get("user");
  const { provider, provider_token, provider_refresh_token } = parsed.data;
  // Canonical storage unit for credentials.expiresAt: epoch milliseconds.
  const expiresAt = Date.now() + 7 * 60 * 60 * 1000;

  const credentials = JSON.stringify({
    email: user.email,
    accessToken: provider_token,
    refreshToken: provider_refresh_token,
    provider,
    expiresAt,
  });

  const admin = createSupabaseAdmin();
  const { error: rpcError } = await admin
    .schema("private")
    .rpc("upsert_mining_source", {
      _user_id: user.id,
      _email: user.email,
      _type: provider,
      _credentials: credentials,
      _encryption_key: envs().hashSecret,
    });

  if (rpcError) {
    logger.error("Failed to upsert mining source", { error: rpcError.message });
    return c.json({ error: rpcError.message }, 500);
  }

  return c.json({ success: true });
});

app.post("/oauth/authorize", authMiddleware, async (c: Context) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = authorizeSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, corsHeaders);
  }

  const user = c.get("user");
  const { provider, redirect } = parsed.data;
  const afterCallbackRedirect = getSafeRedirectPath(redirect);

  const state = await signOAuthState(
    { userId: user.id, afterCallbackRedirect },
    envs().hashSecret,
  );
  const callbackUrl = `${envs().oauthCallbackBaseUrl}/functions/v1/${functionName}/oauth/callback/${provider}`;

  const client = getAuthClient(provider);
  const authorizationUri = client.authorizeURL({
    ...getTokenConfig(provider, callbackUrl),
    state,
  });

  return c.json({ authorizationUri });
});

app.get("/oauth/callback/:provider", async (c: Context) => {
  try {
    const parsed = callbackQuerySchema.safeParse({
      provider: c.req.param("provider"),
      code: c.req.query("code"),
      state: c.req.query("state"),
    });
    if (!parsed.success) {
      return c.redirect(
        `${envs().frontendHost}/callback?error=oauth-permissions&provider=${c.req.param("provider")}&referrer=&navigate_to=/`,
        302,
      );
    }

    const { provider, code, state } = parsed.data;

    const { userId, afterCallbackRedirect } = await parseOAuthState(
      state,
      envs().hashSecret,
    );

    const callbackUrl = `${envs().oauthCallbackBaseUrl}/functions/v1/${functionName}/oauth/callback/${provider}`;

    const token = await exchangeForToken(
      code,
      provider as OAuthMiningSourceProvider,
      callbackUrl,
    );

    const credentials = JSON.stringify({
      email: token.email,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      provider,
      expiresAt: token.expiresAt,
    });

    const admin = createSupabaseAdmin();
    const { error: rpcError } = await admin
      .schema("private")
      .rpc("upsert_mining_source", {
        _user_id: userId,
        _email: token.email,
        _type: provider,
        _credentials: credentials,
        _encryption_key: envs().hashSecret,
      });

    if (rpcError) {
      logger.error("Failed to upsert mining source from callback", {
        error: rpcError.message,
      });
      return c.redirect(
        `${envs().frontendHost}/callback?error=oauth-permissions&provider=${provider}&referrer=${encodeURIComponent(afterCallbackRedirect)}&navigate_to=${encodeURIComponent(afterCallbackRedirect)}`,
        302,
      );
    }

    // Fresh credentials were just stored: clear any stale auth-failure flag so
    // the UI stops showing "connection lost" for a source that now works.
    // (The upsert RPC preserves config by design; only an auth flag set by an
    // earlier rejection is cleared — mining Error states are left untouched.)
    try {
      const { data: row } = await admin
        .schema("private")
        .from("mining_sources")
        .select("config")
        .eq("user_id", userId)
        .eq("email", token.email)
        .single();
      const config =
        row && typeof row.config === "object" && row.config !== null
          ? (row.config as Record<string, unknown>)
          : {};
      const health =
        typeof config.health === "object" && config.health !== null
          ? (config.health as Record<string, unknown>)
          : {};
      if (health.state === SourceHealthState.NeedsReauth) {
        await admin
          .schema("private")
          .from("mining_sources")
          .update({
            config: {
              ...config,
              health: { ...health, state: SourceHealthState.Active, last_error: null },
            },
          })
          .eq("user_id", userId)
          .eq("email", token.email);
        logger.info("Cleared stale re-auth flag after OAuth reconnect", {
          userId,
        });
      }
    } catch (healthError) {
      // Non-fatal: the reconnect itself succeeded; the flag clears on next use.
      logger.warn("Failed to clear re-auth flag after OAuth reconnect", {
        error:
          healthError instanceof Error
            ? healthError.message
            : String(healthError),
      });
    }

    const { data: sourceData, error: sourceError } = await admin
      .schema("private")
      .from("mining_sources")
      .select("id")
      .eq("user_id", userId)
      .eq("email", token.email)
      .single();

    if (sourceError) {
      logger.warn("Failed to get mining source ID for SMTP twin", {
        error: sourceError.message,
      });
    } else {
      const { error: smtpError } = await admin
        .schema("private")
        .rpc("create_smtp_sender_for_oauth", {
          _user_id: userId,
          _email: token.email,
          _provider: provider,
          _oauth_refresh_token: token.refreshToken,
          _mining_source_id: sourceData.id,
          _encryption_key: envs().hashSecret,
        });

      if (smtpError) {
        logger.warn("Failed to create SMTP sender twin for OAuth source", {
          error: smtpError.message,
        });
      }
    }

    let redirectUrl = afterCallbackRedirect;
    if (afterCallbackRedirect.startsWith("/mine")) {
      redirectUrl = `${afterCallbackRedirect}?source=${encodeURIComponent(token.email)}`;
    }

    return c.redirect(`${envs().frontendHost}${redirectUrl}`, 302);
  } catch (error) {
    logger.error("OAuth callback failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.redirect(
      `${envs().frontendHost}/callback?error=oauth-permissions&provider=${c.req.param("provider")}&referrer=&navigate_to=/`,
      302,
    );
  }
});

app.patch("/:id/config", authMiddleware, async (c: Context) => {
  const sourceId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = configureSourceSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, corsHeaders);
  }

  const admin = createSupabaseAdmin();
  const user = c.get("user") as { id: string } | undefined;

  // Service-role callers (completion/health) may update any source; user JWTs
  // may only update their own sources.
  if (user) {
    const { data: owned, error: ownerError } = await admin
      .schema("private")
      .from("mining_sources")
      .select("id")
      .eq("id", sourceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (ownerError || !owned) {
      return c.json({ error: "Mining source not found" }, 404);
    }
  }

  try {
    // Single writer: read-merge-CAS-write of the config.
    const result = await applySourceConfig(
      sourceId,
      parsed.data as ConfigureSourceParams,
    );
    if (!result) {
      return c.json({ error: "Mining source not found" }, 404);
    }
    return c.json({ config: result.config });
  } catch (error) {
    logger.error("Failed to patch mining source config", {
      sourceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: "Failed to update mining source config" }, 500);
  }
});

Deno.serve((req) => app.fetch(req));
