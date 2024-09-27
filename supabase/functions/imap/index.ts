import corsHeaders from "../_shared/cors.ts";
import Logger from "../_shared/logger.ts";
import { createSupabaseClient } from "../_shared/supabase-self-hosted.ts";
import IMAPSettingsDetector from "npm:@ankaboot.io/imap-autoconfig";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

  const client = createSupabaseClient(authorization);
  const { email } = await req.json();

  if (!email) {
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

  try {
    const config = await new IMAPSettingsDetector.default().detect(email);

    if (error) {
      throw error;
    }

    return new Response(config ? JSON.stringify(config) : null, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    Logger.error(error.message);

    return new Response(JSON.stringify(error), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
