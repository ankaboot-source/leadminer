import { Context, Hono } from "hono";
import { z } from "zod";
import corsHeaders from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
} from "../_shared/supabase.ts";
import { validationErrorResponse } from "../_shared/validation.ts";
import {
  getAuthClient,
  getTokenConfig,
  exchangeForToken,
  parseOAuthState,
  getSafeRedirectPath,
  type OAuthMiningSourceProvider,
} from "./oauth/utils.ts";

const logger = createLogger("mining-sources");
const functionName = "mining-sources";
const app = new Hono().basePath(`/${functionName}`);

const _SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const FRONTEND_HOST = Deno.env.get("FRONTEND_HOST") as string;
const HASH_SECRET = Deno.env.get("LEADMINER_API_HASH_SECRET") as string;

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
  const supabase = createSupabaseClient(authHeader);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", data.user);
  return next();
}

const createSchema = z.object({
  provider: z.enum(["google", "azure"]),
  provider_token: z.string().min(1),
  provider_refresh_token: z.string().optional().default(""),
});

const authorizeSchema = z.object({
  provider: z.enum(["google", "azure"]),
  redirect: z.string().min(1).startsWith("/"),
});

app.post("/", authMiddleware, async (c: Context) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, corsHeaders);
  }

  const user = c.get("user");
  const { provider, provider_token, provider_refresh_token } = parsed.data;
  const expiresAt = Date.now() + 7 * 60 * 60 * 1000;

  const credentials = {
    accessToken: provider_token,
    refreshToken: provider_refresh_token,
    expiresAt,
  };

  const admin = createSupabaseAdmin();
  const { error: rpcError } = await admin
    .schema("private")
    .rpc("upsert_mining_source", {
      _user_id: user.id,
      _email: user.email,
      _type: provider,
      _credentials: credentials,
      _encryption_key: HASH_SECRET,
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

  const state = btoa(JSON.stringify({ userId: user.id, afterCallbackRedirect }));
  const callbackUrl = `${SUPABASE_URL}/functions/v1/${functionName}/oauth/callback/${provider}`;

  const client = getAuthClient(provider);
  const authorizationUri = client.authorizeURL({
    ...getTokenConfig(provider, callbackUrl),
    state,
  });

  return c.json({ authorizationUri });
});

app.get("/oauth/callback/:provider", async (c: Context) => {
  try {
    const provider = c.req.param("provider");
    if (provider !== "google" && provider !== "azure") {
      return c.redirect(
        `${FRONTEND_HOST}/callback?error=oauth-permissions&provider=${provider}&referrer=&navigate_to=/`,
        302,
      );
    }

    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!code || !state) {
      return c.redirect(
        `${FRONTEND_HOST}/callback?error=oauth-permissions&provider=${provider}&referrer=&navigate_to=/`,
        302,
      );
    }

    const { userId, afterCallbackRedirect } = parseOAuthState(state);

    const callbackUrl = `${SUPABASE_URL}/functions/v1/${functionName}/oauth/callback/${provider}`;

    const token = await exchangeForToken(
      code,
      provider as OAuthMiningSourceProvider,
      callbackUrl,
    );

    const credentials = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
    };

    const admin = createSupabaseAdmin();
    const { error: rpcError } = await admin
      .schema("private")
      .rpc("upsert_mining_source", {
        _user_id: userId,
        _email: token.email,
        _type: provider,
        _credentials: credentials,
        _encryption_key: HASH_SECRET,
      });

    if (rpcError) {
      logger.error("Failed to upsert mining source from callback", {
        error: rpcError.message,
      });
      return c.redirect(
        `${FRONTEND_HOST}/callback?error=oauth-permissions&provider=${provider}&referrer=${encodeURIComponent(afterCallbackRedirect)}&navigate_to=${encodeURIComponent(afterCallbackRedirect)}`,
        302,
      );
    }

    let redirectUrl = afterCallbackRedirect;
    if (afterCallbackRedirect.startsWith("/mine")) {
      redirectUrl = `${afterCallbackRedirect}?source=${encodeURIComponent(token.email)}`;
    }

    return c.redirect(`${FRONTEND_HOST}${redirectUrl}`, 302);
  } catch (error) {
    logger.error("OAuth callback failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.redirect(
      `${FRONTEND_HOST}/callback?error=oauth-permissions&provider=${c.req.param("provider")}&referrer=&navigate_to=/`,
      302,
    );
  }
});

Deno.serve((req) => app.fetch(req));
