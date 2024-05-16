// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import { createClient } from "@supabase/supabase-js";
import { Pool, PoolClient } from "postgres";
import { Logger } from "../_shared/logger.ts";
import { MiningSource, MiningSourceType } from "../_shared/types.ts";
import { corsHeaders } from "../_shared/cors.ts";

const upsert = async (connection: PoolClient, {
  userId,
  credentials,
  email,
  type,
}: MiningSource) => {
  try {
    const LEADMINER_API_HASH_SECRET = Deno.env.get("LEADMINER_API_HASH_SECRET");

    await connection.queryObject`
INSERT INTO mining_sources ("user_id","email","type","credentials")
VALUES(${userId}, '${email}', ${type},pgp_sym_encrypt(${
      JSON.stringify(credentials)
    }, ${LEADMINER_API_HASH_SECRET}))
ON CONFLICT (email, user_id)
DO UPDATE SET credentials=excluded.credentials,type=excluded.type;
    `;
  } catch (error) {
    if (error instanceof Error) {
      Logger.error(`Failed upserting credentials ${error}`);
    }
    throw error;
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const databaseUrl = Deno.env.get("DATABASE_URL");

  if (!supabaseUrl || !supabaseAnonKey || !databaseUrl) {
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
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const { provider, provider_token: providerToken } = await req.json();

  if (!providerToken) {
    return new Response(
      null,
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    Logger.error(error.message);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!user) {
    return new Response(
      null,
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      },
    );
  }

  const expiresAt = new Date().setHours(new Date().getHours() + 7);

  try {
    await supabase.from("mining_sources").upsert({
      user_id: user.id,
      email: user.email as string,
      credentials: {
        email: user.email as string,
        accessToken: providerToken,
        refreshToken: "",
        provider,
        expiresAt,
      },
      type: provider as MiningSourceType,
    });

    return new Response(
      null,
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    Logger.error(`error.message`);

    return new Response(
      JSON.stringify(error),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/add-mining-source' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
