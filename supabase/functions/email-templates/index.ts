import Logger from "../_shared/logger.ts";
import corsHeaders from "../_shared/cors.ts";
import supabaseEmailsI18n from "./templates.ts";
import {
  createSupabaseAdmin,
  createSupabaseClient,
} from "../_shared/supabase.ts";

Deno.serve(async (req) => {
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

  if (req.method === "GET") {
    const url = new URL(req.url);
    const language = url.searchParams.get("language");
    const template = supabaseEmailsI18n.get(language as string) ?? null;
    return new Response(JSON.stringify(template), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization) {
    return new Response(
      JSON.stringify({ error: "No authorization header passed" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const { language } = await req.json();

    if (!language || !supabaseEmailsI18n.has(language)) {
      return new Response(
        JSON.stringify({ error: "Language is missing or not supported." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createSupabaseAdmin();
    const supabase = createSupabaseClient(authorization);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentTemplate = user.user_metadata?.EmailTemplate;

    if (!currentTemplate || currentTemplate.language !== language) {
      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          user_metadata: {
            EmailTemplate: {
              language,
              ...supabaseEmailsI18n.get(language),
            },
          },
        });

      if (updateError) {
        throw updateError;
      }
    }

    return new Response(null, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    Logger.error((error as Error).message || "Failed to process the request");
    return new Response(
      JSON.stringify({ error: "Failed to process the request" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
