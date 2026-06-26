import { Hono, Context, Next } from "hono";
import corsHeaders from "../_shared/cors.ts";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { authMiddleware } from "./middlewares.ts";
import { initI18n, t, getUserLocale } from "./i18n.ts";
import { ContactsClient } from "./contacts-client.ts";
import ExportFactory from "./formats/factory.ts";
import { ExportType, ModalResponse, ExportRequestBody, ExportOptions } from "./types.ts";
import { getRequiredEnv } from "../_shared/env-helpers.ts";

const functionName = "export-contacts";
const logger = createLogger(functionName);
const SUPABASE_URL = getRequiredEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

const app = new Hono().basePath(`/${functionName}`);

app.use("*", async (c, next) => {
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

app.options("*", () => new Response("ok", { headers: corsHeaders }));

app.post("/:type", authMiddleware, async (c: Context) => {
  const rawType = c.req.param("type") as string;
  const exportType = rawType as ExportType;

  if (!Object.values(ExportType).includes(exportType)) {
    return c.json(
      { error: `Invalid export type: ${rawType}` },
      400,
    );
  }

  let body: ExportRequestBody;
  try {
    body = await c.req.json<ExportRequestBody>();
  } catch {
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  if (!body.exportAllContacts && (!Array.isArray(body.ids) || !body.ids.length)) {
    return c.json({ error: 'Parameter "ids" must be a non-empty list of person ids' }, 400);
  }

  const user = c.get("user");
  const locale = getUserLocale(user.user_metadata || {});
  await initI18n(locale);

  const supabaseAdmin = createSupabaseAdmin();
  const contactsClient = new ContactsClient(supabaseAdmin);

  try {
    const contactsToExport = body.exportAllContacts ? undefined : body.ids;
    const selectedContacts = await contactsClient.getContacts(
      user.id,
      contactsToExport,
    );

    if (!selectedContacts.length) {
      return c.body(null, 204);
    }

    const exportOptions: ExportOptions = {
      locale,
    };

    if (exportType === ExportType.GOOGLE_CONTACTS) {
      if (!body.miningSourceId) {
        return c.json({ error: "miningSourceId is required for Google Contacts export" }, 400);
      }

      const oauthCredentials = await resolveGoogleOAuthTokens(
        supabaseAdmin,
        user.id,
        body.miningSourceId,
      );

      if (!oauthCredentials) {
        return c.json(
          {
            type: "modal",
            title: t("modals.google_auth.title"),
            description: t("modals.google_auth.description"),
            data: { total: 0, available: 0, availableAlready: 0, reason: "auth" },
            buttons: [
              {
                title: t("modals.google_auth.buttons.reconnect"),
                action: "reconnect_google",
                severity: "primary",
              },
              {
                title: t("modals.google_auth.buttons.cancel"),
                action: "cancel",
                variant: "text",
              },
            ],
          } satisfies ModalResponse,
          401,
        );
      }

      exportOptions.googleContactsOptions = {
        userId: user.id,
        accessToken: oauthCredentials.accessToken,
        refreshToken: oauthCredentials.refreshToken,
        updateEmptyFieldsOnly: body.updateEmptyFieldsOnly ?? false,
      };
    }

    const { content, contentType } = await ExportFactory.get(exportType).export(
      selectedContacts,
      exportOptions,
    );

    return c.newResponse(content, 200, {
      "Content-Type": contentType,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Export failed", { userId: user.id, error: msg });

    if (msg === "Invalid credentials.") {
      return c.json(
        {
          type: "modal",
          title: t("modals.google_auth.title"),
          description: t("modals.google_auth.description"),
          data: { total: 0, available: 0, availableAlready: 0, reason: "auth" },
          buttons: [
            {
              title: t("modals.google_auth.buttons.reconnect"),
              action: "reconnect_google",
              severity: "primary",
            },
            {
              title: t("modals.google_auth.buttons.cancel"),
              action: "cancel",
              variant: "text",
            },
          ],
        } satisfies ModalResponse,
        401,
      );
    }

    return c.json({ error: t("errors.export_failed"), details: msg }, 500);
  }
});

async function resolveGoogleOAuthTokens(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  miningSourceId: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const { data: source, error } = await supabaseAdmin
      .schema("private")
      .from("mining_sources")
      .select("email, type, credentials")
      .eq("id", miningSourceId)
      .eq("user_id", userId)
      .single();

    if (error || !source || source.type !== "google") {
      logger.warn("Mining source not found or not Google type", {
        userId,
        miningSourceId,
      });
      return null;
    }

    const fetchResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/fetch-mining-source`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: source.email,
          user_id: userId,
        }),
      },
    );

    if (!fetchResponse.ok) {
      logger.error("fetch-mining-source returned error", {
        status: fetchResponse.status,
      });
      return null;
    }

    const data = await fetchResponse.json();
    const googleSource = data.sources?.find(
      (s: { email: string; type: string; credentials: { accessToken: string; refreshToken: string } }) =>
        s.type === "google" && s.email === source.email,
    );

    if (!googleSource?.credentials) {
      return null;
    }

    return {
      accessToken: googleSource.credentials.accessToken,
      refreshToken: googleSource.credentials.refreshToken,
    };
  } catch (err) {
    logger.error("Failed to resolve OAuth tokens", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

Deno.serve((req) => app.fetch(req));
