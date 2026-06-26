import { Context, Hono } from "hono";
import corsHeaders from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { initI18n, t, getUserLocale } from "./i18n.ts";
import { enrichSync, type Person, type EngineResponse } from "./services/engines.ts";
import { validationErrorResponse } from "../_shared/validation.ts";
import {
  personBodySchema,
  bulkPersonBodySchema,
  webhookBodySchema,
  webhookParamsSchema,
} from "./schemas.ts";
import { mixedAuth } from "../_shared/middlewares.ts";

const logger = createLogger("enrich");
const functionName = "enrich";
const app = new Hono().basePath(`/${functionName}`);

interface ModalButton {
  title: string;
  link?: string;
  action?: string;
  severity?: "primary" | "secondary" | "contrast";
  variant?: "outlined" | "text" | "link";
  icon?: string;
}

interface ModalResponse {
  type: "modal";
  title: string;
  description: string;
  data: {
    total: number;
    available: number;
    availableAlready: number;
    reason?: string;
  };
  buttons: ModalButton[];
}

interface EnrichedCacheRow {
  task_id: string;
  user_id: string;
  engine: string;
  result: unknown;
}

app.use("*", async (c, next) => {
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});
app.options("*", () => new Response("ok", { headers: corsHeaders }));

app.post("/person", mixedAuth, async (c: Context) => {
  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = personBodySchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, corsHeaders);
  }
  const { email, name, id: contactId } = parsed.data;

  const locale = getUserLocale(user.user_metadata || {});
  await initI18n(locale);

  const supabaseAdmin = createSupabaseAdmin();

  try {
    const { data: cacheData, error: cacheError } = await supabaseAdmin
      .schema("private")
      .rpc("enriched_most_recent", { emails: [email] });

    if (cacheError) {
      logger.error("Cache check failed", { error: cacheError.message, email });
    }

    if (cacheData && (cacheData as EnrichedCacheRow[]).length > 0) {
      const cached = (cacheData as EnrichedCacheRow[])[0];
      logger.info("Enrichment cache hit", { email, engine: cached.engine });

      const { error: updateError } = await supabaseAdmin
        .schema("private")
        .rpc("enrich_contacts", {
          p_contacts_data: [cached.result],
          p_update_empty_fields_only: true,
        });

      if (updateError) {
        logger.error("Failed to update contacts from cache", {
          error: updateError.message,
        });
      }

      return c.json({
        type: "modal",
        title: t("success.title"),
        description: t("success.description", { count: 1 }),
        data: { total: 1, available: 1, availableAlready: 1 },
        buttons: [],
      } satisfies ModalResponse);
    }
  } catch (err) {
    logger.error("Cache check error", {
      error: (err as Error).message,
      email,
    });
  }

  let taskId: string | null = null;
  try {
    const { data: taskData, error: taskError } = await supabaseAdmin
      .schema("private")
      .from("tasks")
      .insert({
        user_id: user.id,
        status: "running",
        type: "enrich",
        category: "enriching",
        details: {
          total_enriched: 0,
          total_to_enrich: 1,
          update_empty_fields_only: true,
          result: [],
        },
      })
      .select("id")
      .single();

    if (taskError) {
      throw new Error(taskError.message);
    }

    taskId = taskData?.id ?? null;
  } catch (err) {
    logger.error("Failed to create task", {
      error: (err as Error).message,
      userId: user.id,
    });
    return c.json({ error: "Failed to create enrichment task" }, 500);
  }

  try {
    const person: Partial<Person> = {
      email,
      name,
      url: "",
      identifiers: contactId ? [contactId] : [],
    };

    const result = await enrichSync(person);

    if (!result || result.data.length === 0) {
      if (taskId) {
        await supabaseAdmin
          .schema("private")
          .from("tasks")
          .update({
            status: "done",
            details: {
              total_enriched: 0,
              total_to_enrich: 1,
              update_empty_fields_only: true,
              result: [result || { engine: "none", data: [], raw_data: [] }],
            },
          })
          .eq("id", taskId);
      }

      return c.json({
        type: "modal",
        title: t("no_data.title"),
        description: t("no_data.description"),
        data: {
          total: 1,
          available: 0,
          availableAlready: 0,
          reason: "no_data",
        },
        buttons: [],
      } satisfies ModalResponse);
    }

    const contactsData = result.data.map((d) => ({
      ...d,
      user_id: user.id,
      person_id: contactId || d.person_id,
    }));

    const { error: updateError } = await supabaseAdmin
      .schema("private")
      .rpc("enrich_contacts", {
        p_contacts_data: contactsData,
        p_update_empty_fields_only: true,
      });

    if (updateError) {
      logger.error("Failed to update contacts", { error: updateError.message });
      throw new Error(updateError.message);
    }

    if (taskId) {
      await supabaseAdmin
        .schema("private")
        .from("tasks")
        .update({
          status: "done",
          details: {
            total_enriched: 1,
            total_to_enrich: 1,
            update_empty_fields_only: true,
            result: [result],
          },
        })
        .eq("id", taskId);
    }

    logger.info("Enrichment completed successfully", {
      email,
      engine: result.engine,
      dataCount: result.data.length,
    });

    return c.json({
      type: "modal",
      title: t("success.title"),
      description: t("success.description", { count: 1 }),
      data: { total: 1, available: 1, availableAlready: 0 },
      buttons: [],
    } satisfies ModalResponse);
  } catch (err) {
    const errorMessage = (err as Error).message || "Unknown enrichment error";
    logger.error("Enrichment failed", { error: errorMessage, email });

    if (taskId) {
      try {
        await supabaseAdmin
          .schema("private")
          .from("tasks")
          .update({
            status: "canceled",
            details: {
              total_enriched: 0,
              total_to_enrich: 1,
              update_empty_fields_only: true,
              error: [errorMessage],
              result: [],
            },
          })
          .eq("id", taskId);
      } catch (taskUpdateErr) {
        logger.error("Failed to update task status", {
          error: (taskUpdateErr as Error).message,
        });
      }
    }

    return c.json({
      type: "modal",
      title: t("engine_error.title"),
      description: t("engine_error.description"),
      data: {
        total: 1,
        available: 0,
        availableAlready: 0,
        reason: "engine_error",
      },
      buttons: [],
    } satisfies ModalResponse);
  }
});

// POST /enrich/person/bulk - Bulk enrichment
app.post("/person/bulk", mixedAuth, async (c: Context) => {
  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = bulkPersonBodySchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, corsHeaders);
  }
  const { contacts: inputContacts, enrichAllContacts, updateEmptyFieldsOnly } = parsed.data;

  const shouldUpdateEmptyOnly = updateEmptyFieldsOnly !== false;

  const locale = getUserLocale(user.user_metadata || {});
  await initI18n(locale);

  const supabaseAdmin = createSupabaseAdmin();

  let contactsToEnrich: Array<{ email: string; name?: string; id?: string }> =
    [];

  if (enrichAllContacts) {
    try {
      const { data: refinedPersons, error: rpError } = await supabaseAdmin
        .schema("private")
        .from("refinedpersons")
        .select("person_id")
        .eq("user_id", user.id);

      if (rpError) {
        throw new Error(rpError.message);
      }

      if (!refinedPersons || refinedPersons.length === 0) {
        return c.json({
          type: "modal",
          title: t("no_data.title"),
          description: t("no_data.description"),
          data: {
            total: 0,
            available: 0,
            availableAlready: 0,
            reason: "no_data",
          },
          buttons: [],
        } satisfies ModalResponse);
      }

      const personIds = refinedPersons.map(
        (rp: { person_id: string }) => rp.person_id,
      );

      const { data: persons, error: personsError } = await supabaseAdmin
        .schema("private")
        .from("persons")
        .select("id, email, name")
        .in("id", personIds);

      if (personsError) {
        throw new Error(personsError.message);
      }

      contactsToEnrich = (persons || []).map(
        (p: { id: string; email: string; name?: string }) => ({
          email: p.email,
          name: p.name,
          id: p.id,
        }),
      );
    } catch (err) {
      logger.error("Failed to fetch contacts for enrichAllContacts", {
        error: (err as Error).message,
        userId: user.id,
      });
      return c.json({ error: "Failed to fetch contacts" }, 500);
    }
  } else {
    contactsToEnrich = inputContacts || [];
  }

  if (contactsToEnrich.length === 0) {
    return c.json({
      type: "modal",
      title: t("no_data.title"),
      description: t("no_data.description"),
      data: { total: 0, available: 0, availableAlready: 0, reason: "no_data" },
      buttons: [],
    } satisfies ModalResponse);
  }

  const emails = contactsToEnrich.map((c) => c.email);
  let cachedResults: EnrichedCacheRow[] = [];
  try {
    const { data: cacheData, error: cacheError } = await supabaseAdmin
      .schema("private")
      .rpc("enriched_most_recent", { emails });

    if (cacheError) {
      logger.error("Cache check failed for bulk", {
        error: cacheError.message,
      });
    }

    if (cacheData) {
      cachedResults = cacheData as EnrichedCacheRow[];
    }
  } catch (err) {
    logger.error("Cache check error for bulk", {
      error: (err as Error).message,
    });
  }

  const cachedEmails = new Set(
    cachedResults
      .map((r) =>
        r.result && typeof r.result === "object"
          ? ((r.result as Record<string, unknown>).email as string)
          : undefined,
      )
      .filter(Boolean),
  );

  const uncachedContacts = contactsToEnrich.filter(
    (c) => !cachedEmails.has(c.email),
  );

  if (cachedResults.length > 0) {
    try {
      const cacheContactsData = cachedResults.map((r) => r.result);
      const { error: updateCacheError } = await supabaseAdmin
        .schema("private")
        .rpc("enrich_contacts", {
          p_contacts_data: cacheContactsData,
          p_update_empty_fields_only: shouldUpdateEmptyOnly,
        });

      if (updateCacheError) {
        logger.error("Failed to update contacts from cache (bulk)", {
          error: updateCacheError.message,
        });
      }
    } catch (err) {
      logger.error("Cache update error for bulk", {
        error: (err as Error).message,
      });
    }
  }

  if (uncachedContacts.length === 0) {
    return c.json({
      type: "modal",
      title: t("success.title"),
      description: t("success.description", { count: cachedResults.length }),
      data: {
        total: contactsToEnrich.length,
        available: 0,
        availableAlready: cachedResults.length,
      },
      buttons: [],
    } satisfies ModalResponse);
  }

  const contactsToProcess = uncachedContacts;

  let taskId: string | null = null;
  try {
    const { data: taskData, error: taskError } = await supabaseAdmin
      .schema("private")
      .from("tasks")
      .insert({
        user_id: user.id,
        status: "running",
        type: "enrich",
        category: "enriching",
        details: {
          total_enriched: 0,
          total_to_enrich: contactsToProcess.length,
          update_empty_fields_only: shouldUpdateEmptyOnly,
          result: [],
        },
      })
      .select("id")
      .single();

    if (taskError) {
      throw new Error(taskError.message);
    }

    taskId = taskData?.id ?? null;
  } catch (err) {
    logger.error("Failed to create bulk task", {
      error: (err as Error).message,
      userId: user.id,
    });
    return c.json({ error: "Failed to create enrichment task" }, 500);
  }

  const enrichedResults: EngineResponse[] = [];
  const enrichedContactsData: Record<string, unknown>[] = [];
  let enrichedCount = 0;

  for (const contact of contactsToProcess) {
    try {
      const person: Partial<Person> = {
        email: contact.email,
        name: contact.name,
        url: "",
        identifiers: contact.id ? [contact.id] : [],
      };

      const result = await enrichSync(person);

      if (result && result.data.length > 0) {
        enrichedResults.push(result);
        const contactsData = result.data.map((d) => ({
          ...d,
          person_id: contact.id || d.person_id,
        }));
        enrichedContactsData.push(...contactsData);
        enrichedCount++;
      }
    } catch (err) {
      logger.error("Enrichment failed for contact", {
        error: (err as Error).message,
        email: contact.email,
      });
    }
  }

  if (enrichedContactsData.length > 0) {
    try {
      const { error: updateError } = await supabaseAdmin
        .schema("private")
        .rpc("enrich_contacts", {
          p_contacts_data: enrichedContactsData,
          p_update_empty_fields_only: shouldUpdateEmptyOnly,
        });

      if (updateError) {
        logger.error("Failed to update contacts (bulk)", {
          error: updateError.message,
        });
        throw new Error(updateError.message);
      }
    } catch (err) {
      logger.error("Contact update failed for bulk", {
        error: (err as Error).message,
      });
    }
  }

  if (taskId) {
    try {
      await supabaseAdmin
        .schema("private")
        .from("tasks")
        .update({
          status: "done",
          details: {
            total_enriched: enrichedCount,
            total_to_enrich: contactsToProcess.length,
            update_empty_fields_only: shouldUpdateEmptyOnly,
            result: enrichedResults,
          },
        })
        .eq("id", taskId);
    } catch (err) {
      logger.error("Failed to update task status (bulk)", {
        error: (err as Error).message,
      });
    }
  }

  logger.info("Bulk enrichment completed", {
    userId: user.id,
    total: contactsToEnrich.length,
    enriched: enrichedCount,
    cached: cachedResults.length,
  });

  const totalAvailable = enrichedCount + cachedResults.length;

  return c.json({
    type: "modal",
    title: t("success.title"),
    description: t("success.description", { count: totalAvailable }),
    data: {
      total: contactsToEnrich.length,
      available: totalAvailable,
      availableAlready: cachedResults.length,
    },
    buttons: [],
  } satisfies ModalResponse);
});

app.post("/webhook/:id", async (c) => {
  const paramsParsed = webhookParamsSchema.safeParse(c.req.param());
  if (!paramsParsed.success) {
    return validationErrorResponse(paramsParsed.error, corsHeaders);
  }
  const { id } = paramsParsed.data;

  const body = await c.req.json().catch(() => ({}));
  const parsed = webhookBodySchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, corsHeaders);
  }
  const { token, results } = parsed.data;

  const supabaseAdmin = createSupabaseAdmin();

  const { data: task, error: taskError } = await supabaseAdmin
    .schema("private")
    .from("tasks")
    .select("id, user_id, details")
    .eq("id", id)
    .single();

  if (taskError || !task) {
    logger.error("Webhook: task not found", {
      taskId: id,
      error: taskError?.message,
    });
    return c.json({ error: "Task not found" }, 404);
  }

  const resultEntry = task.details?.result?.find(
    (r: { token?: string }) => r.token === token,
  );

  if (!resultEntry) {
    logger.warn("Webhook: invalid token", { taskId: id, token });
    return c.json({ error: "Invalid token" }, 403);
  }

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
    task.user_id,
  );
  const locale = getUserLocale(userData?.user?.user_metadata || {});
  await initI18n(locale);

  const parsedResults = results || [];

  const existingResults = task.details?.result || [];
  const updatedResults = existingResults.map(
    (r: {
      token?: string;
      engine?: string;
      data?: unknown[];
      raw_data?: unknown[];
    }) => {
      if (r.token === token) {
        return {
          ...r,
          data: parsedResults,
          raw_data: [parsedResults],
        };
      }
      return r;
    },
  );

  const { error: updateError } = await supabaseAdmin
    .schema("private")
    .from("tasks")
    .update({
      status: "done",
      details: {
        ...task.details,
        result: updatedResults,
      },
    })
    .eq("id", id);

  if (updateError) {
    logger.error("Webhook: failed to update task", {
      taskId: id,
      error: updateError.message,
    });
    return c.json({ error: "Failed to update task" }, 500);
  }

  logger.info("Webhook: task updated successfully", {
    taskId: id,
    resultCount: parsedResults.length,
  });

  return c.json({
    type: "modal",
    title: t("success.title"),
    description: t("success.description", { count: parsedResults.length }),
    data: {
      total: parsedResults.length,
      available: parsedResults.length,
      availableAlready: 0,
    },
    buttons: [],
  } satisfies ModalResponse);
});

Deno.serve(app.fetch);
