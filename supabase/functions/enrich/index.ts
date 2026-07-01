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
import EnrichmentsClient from "./services/enrichments-client.ts";
import TasksClient from "./services/tasks-client.ts";
import {
  enrichFromCache,
  getContactsToEnrich,
  getEnrichmentCache,
  type EnrichmentContactRow,
} from "./services/enrichment-helpers.ts";
import type { Task } from "./services/db-types.ts";

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
  const enrichments = new EnrichmentsClient(supabaseAdmin, logger);

  // 1. Cache check — if we have a fresh enrichment for this email, just
  //    write it through to the contacts table and return a success modal.
  try {
    const { cachedResults } = await getEnrichmentCache(
      supabaseAdmin,
      [email],
      logger,
    );

    if (cachedResults.length > 0) {
      const cached = cachedResults[0];
      logger.info("Enrichment cache hit", { email, engine: cached.engine });
      await enrichFromCache(supabaseAdmin, [cached], true, logger);

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

  // 2. Create the enrichment task in `running` state.
  let task;
  try {
    task = await enrichments.create(user.id, 1, true);
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
      await enrichments.completeWithEmptyResult(result);
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

    // Map the original contact id back onto each data row so the
    // `enrich_contacts` RPC can find the person to update.
    const mappedResult: EngineResponse = {
      ...result,
      data: result.data.map((d) => ({
        ...d,
        person_id: contactId || d.person_id,
      })),
    };

    await enrichments.enrich([mappedResult]);
    await enrichments.end();

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

    try {
      const canceledTask: Task = {
        ...task,
        status: "canceled",
        details: {
          ...task.details,
          error: [errorMessage],
          result: [],
        },
      };
      const tasksClient = new TasksClient(supabaseAdmin, logger);
      await tasksClient.update(canceledTask);
    } catch (taskUpdateErr) {
      logger.error("Failed to update task status", {
        error: (taskUpdateErr as Error).message,
      });
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

// ─── Handler: POST /enrich/person/bulk - Bulk enrichment ────────────────────

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

  // 1. Fetch contacts (either all or provided)
  let contactsToEnrich: EnrichmentContactRow[];
  if (enrichAllContacts) {
    try {
      contactsToEnrich = await getContactsToEnrich(supabaseAdmin, user.id);
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

  // 2. Check cache and persist any hits.
  const emails = contactsToEnrich.map((c) => c.email);
  const { cachedResults, cachedEmails } = await getEnrichmentCache(
    supabaseAdmin,
    emails,
    logger,
  );
  const uncachedContacts = contactsToEnrich.filter(
    (c) => !cachedEmails.has(c.email),
  );

  if (cachedResults.length > 0) {
    await enrichFromCache(
      supabaseAdmin,
      cachedResults,
      shouldUpdateEmptyOnly,
      logger,
    );
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

  // 3. Create enrichment task for the uncached contacts.
  const enrichments = new EnrichmentsClient(supabaseAdmin, logger);
  try {
    await enrichments.create(
      user.id,
      uncachedContacts.length,
      shouldUpdateEmptyOnly,
    );
  } catch (err) {
    logger.error("Failed to create bulk task", {
      error: (err as Error).message,
      userId: user.id,
    });
    return c.json({ error: "Failed to create enrichment task" }, 500);
  }

  // 4. Run enrichment for each uncached contact.
  const enrichedResults: EngineResponse[] = [];
  for (const contact of uncachedContacts) {
    try {
      const person: Partial<Person> = {
        email: contact.email,
        name: contact.name,
        url: "",
        identifiers: contact.id ? [contact.id] : [],
      };

      const result = await enrichSync(person);

      if (result && result.data.length > 0) {
        enrichedResults.push({
          ...result,
          data: result.data.map((d) => ({
            ...d,
            person_id: contact.id || d.person_id,
          })),
        });
      }
    } catch (err) {
      logger.error("Enrichment failed for contact", {
        error: (err as Error).message,
        email: contact.email,
      });
    }
  }

  // 5. Hand the results to EnrichmentsClient — it updates contacts,
  //    writes engagement rows, and merges the result into the task.
  try {
    await enrichments.enrich(enrichedResults);
    await enrichments.end();
  } catch (err) {
    logger.error("Failed to finalize bulk task", {
      error: (err as Error).message,
    });
    try {
      await enrichments.cancel();
    } catch (cancelErr) {
      logger.error("Failed to cancel bulk task", {
        error: (cancelErr as Error).message,
      });
    }
  }

  logger.info("Bulk enrichment completed", {
    userId: user.id,
    total: contactsToEnrich.length,
    enriched: enrichedResults.length,
    cached: cachedResults.length,
  });

  const totalAvailable = enrichedResults.length + cachedResults.length;

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
  const tasksClient = new TasksClient(supabaseAdmin, logger);

  let task;
  try {
    task = await tasksClient.getById(id);
  } catch (err) {
    logger.error("Webhook: task not found", {
      taskId: id,
      error: (err as Error).message,
    });
    return c.json({ error: "Task not found" }, 404);
  }

  const existingResults = (task.details?.result ?? []) as Array<{
    token?: string;
    engine?: string;
    data?: unknown[];
    raw_data?: unknown[];
  }>;

  const resultEntry = existingResults.find((r) => r.token === token);
  if (!resultEntry) {
    logger.warn("Webhook: invalid token", { taskId: id, token });
    return c.json({ error: "Invalid token" }, 403);
  }

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
    task.userId,
  );
  const locale = getUserLocale(userData?.user?.user_metadata || {});
  await initI18n(locale);

  const parsedResults = results || [];

  const updatedResults = existingResults.map((r) => {
    if (r.token === token) {
      return {
        ...r,
        data: parsedResults,
        raw_data: [parsedResults],
      };
    }
    return r;
  });

  const updatedTask: Task = {
    ...task,
    status: "done",
    details: {
      ...(task.details as Record<string, unknown>),
      result: updatedResults,
    },
  };

  try {
    await tasksClient.update(updatedTask);
  } catch (err) {
    logger.error("Webhook: failed to update task", {
      taskId: id,
      error: (err as Error).message,
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
