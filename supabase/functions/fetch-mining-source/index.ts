/**
 * INTERNAL SERVICE-TO-SERVICE FUNCTION
 *
 * This function returns sensitive credentials (OAuth tokens, passwords).
 * It should ONLY be called from trusted backend services (e.g., email-campaigns)
 * using the service role key via the x-service-key header.
 *
 * DO NOT expose this function to end users or untrusted clients.
 */
import corsHeaders from "../_shared/cors.ts";
import Logger from "../_shared/logger.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
} from "../_shared/supabase.ts";
import {
  isTokenExpired,
  refreshOAuthToken,
} from "../email-campaigns/sender-options.ts";
import * as crypto from "node:crypto";

interface MiningSourceCredentials {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  password?: string;
  imapHost?: string;
  imapPort?: number;
  [key: string]: unknown;
}

interface MiningSource {
  email: string;
  type: string;
  credentials: MiningSourceCredentials;
}

function timingSafeCompare(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBytes, bBytes);
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const leadminerHashSecret = Deno.env.get("LEADMINER_HASH_SECRET");

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseServiceRoleKey ||
    !leadminerHashSecret
  ) {
    Logger.error("Missing environment variables");

    return new Response(
      JSON.stringify({ error: "Missing environment variables" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let mode: "user" | "service" = "user";
  let userId: string | undefined;
  let targetEmail: string | undefined;

  const serviceKey = req.headers.get("x-service-key");
  const authorization = req.headers.get("Authorization");

  if (
    serviceKey && timingSafeCompare(serviceKey, supabaseServiceRoleKey)
  ) {
    mode = "service";
  } else if (!authorization) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const body = await req.json();
    targetEmail = body.email;
    userId = body.user_id;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (targetEmail && targetEmail !== "all" && !isValidEmail(targetEmail)) {
    return new Response(JSON.stringify({ error: "Invalid email format" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createSupabaseAdmin();
  let client: ReturnType<typeof createSupabaseClient>;
  let actualUserId: string;

  if (mode === "service") {
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "user_id required in service mode" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    actualUserId = userId;
    client = createSupabaseClient(`Bearer ${serviceKey}`);
  } else {
    client = createSupabaseClient(authorization!);
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError?.message || "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    actualUserId = user.id;
  }

  const refreshedEmails: string[] = [];

  try {
    let sources: MiningSource[];

    if (mode === "service") {
      const { data, error } = await admin
        .schema("private")
        .rpc("get_mining_source_credentials_for_user", {
          _user_id: actualUserId,
          _encryption_key: leadminerHashSecret,
        });

      if (error) {
        throw new Error("Failed to fetch mining sources");
      }
      sources = (data ?? []) as MiningSource[];
    } else {
      const { data, error } = await client
        .schema("private")
        .rpc("get_user_mining_source_credentials", {
          _encryption_key: leadminerHashSecret,
        });

      if (error) {
        throw new Error("Failed to fetch mining sources");
      }
      sources = (data ?? []) as MiningSource[];
    }

    if (targetEmail && targetEmail !== "all") {
      sources = sources.filter(
        (s) => s.email.toLowerCase() === targetEmail!.toLowerCase(),
      );
    }

    for (const source of sources) {
      const needsRefresh = isTokenExpired(source.credentials);
      if (!needsRefresh) {
        continue;
      }

      Logger.info(`Token expired for ${source.email}, attempting refresh`);

      const refreshed = await refreshOAuthToken(source);
      if (!refreshed) {
        Logger.warn(`Failed to refresh token for ${source.email}`);
        continue;
      }

      const newRefreshToken = refreshed.credentials.refreshToken;
      const preservedRefreshToken =
        newRefreshToken ?? source.credentials.refreshToken;

      await admin.schema("private").rpc("upsert_mining_source", {
        _user_id: actualUserId,
        _email: source.email,
        _type: source.type,
        _credentials: JSON.stringify({
          ...source.credentials,
          accessToken: refreshed.credentials.accessToken,
          refreshToken: preservedRefreshToken,
          expiresAt: refreshed.credentials.expiresAt,
        }),
        _encryption_key: leadminerHashSecret,
      });

      source.credentials = refreshed.credentials;
      refreshedEmails.push(source.email);

      Logger.info(`Successfully refreshed token for ${source.email}`);
    }

    const response = {
      sources: sources.map((s) => ({
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
  } catch (error) {
    Logger.error((error as Error).message);

    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
