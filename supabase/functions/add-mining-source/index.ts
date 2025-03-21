import corsHeaders from "../_shared/cors.ts";
import Logger from "../_shared/logger.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
} from "../_shared/supabase-self-hosted.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    Logger.error("Missing environment variables.");

    return new Response(
      JSON.stringify({
        error: "Missing environment variables.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization) {
    Logger.error("No authorization header passed");

    return new Response(
      JSON.stringify({ error: "No authorization header passed" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const admin = createSupabaseAdmin();
  const client = createSupabaseClient(authorization);

  const { provider, provider_token: providerToken } = await req.json();

  if (!providerToken) {
    return new Response(null, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    Logger.error(error.message);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!user) {
    return new Response(null, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  const expiresAt = new Date().setHours(new Date().getHours() + 7);

  try {
    const { error } = await admin.schema("private").rpc(
      "upsert_mining_source",
      {
        _user_id: user.id,
        _email: user.email,
        _type: provider,
        _credentials: JSON.stringify({
          email: user.email as string,
          accessToken: providerToken,
          refreshToken: "",
          provider,
          expiresAt,
        }),
        _encryption_key: Deno.env.get("LEADMINER_HASH_SECRET"),
      },
    );

    if (error) {
      throw error;
    }

    return new Response(null, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    Logger.error((error as Error).message);

    return new Response(JSON.stringify(error), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
