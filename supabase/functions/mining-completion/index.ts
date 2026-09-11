import { Context, Hono } from "hono";
import { z } from "zod";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { verifyServiceRole } from "../_shared/middlewares.ts";
import { buildCompletionPatch, type TaskDetails } from "./completion.ts";

const logger = createLogger("mining-completion");
const functionName = "mining-completion";
const app = new Hono().basePath(`/${functionName}`);

const bodySchema = z.object({ miningId: z.string().min(1) });

type FetchTaskRow = {
  id: string;
  status: string;
  details: TaskDetails | null;
};

/**
 * Records a successful mining run on its mining source.
 *
 * Triggered by the backend Pipeline when the Extract task succeeds. Reads the
 * fetch task's persisted watermark (written by FetchTask) and applies it
 * through the atomic config writer. Cleaning and signature extraction are
 * optional and never influence this path.
 */
app.post("/", verifyServiceRole, async (c: Context) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Missing miningId" }, 400);
  }
  const { miningId } = parsed.data;

  const admin = createSupabaseAdmin();

  const { data, error } = await admin
    .schema("private")
    .from("tasks")
    .select("id,status,details")
    .contains("details", { miningId })
    .eq("type", "fetch")
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) {
    logger.error("Failed to read fetch task", {
      miningId,
      error: error.message,
    });
    return c.json({ error: "Failed to record mining completion" }, 500);
  }

  const task = (data?.[0] ?? null) as FetchTaskRow | null;
  if (!task || task.status !== "done") {
    logger.warn("No successful fetch task to record", {
      miningId,
      status: task?.status,
    });
    return c.json({ skipped: true, reason: "no-successful-fetch-task" });
  }

  const outcome = buildCompletionPatch(
    task.details,
    miningId,
    new Date().toISOString(),
  );
  if (outcome.skip) {
    logger.warn("Skipping completion record", {
      miningId,
      reason: outcome.reason,
    });
    return c.json({ skipped: true, reason: outcome.reason });
  }

  // Idempotent: a retried trigger for the same run must not rewrite the source.
  const { data: source } = await admin
    .schema("private")
    .from("mining_sources")
    .select("config")
    .eq("id", outcome.sourceId)
    .maybeSingle();
  const currentLast = (
    (source?.config as Record<string, unknown> | undefined)?.mining as
      | Record<string, unknown>
      | undefined
  )?.last as Record<string, unknown> | undefined;
  if (currentLast?.mining_id === miningId) {
    return c.json({ skipped: true, reason: "already-recorded" });
  }

  const { error: rpcError } = await admin
    .schema("private")
    .rpc("update_mining_source_config", {
      p_id: outcome.sourceId,
      p_patch: outcome.patch,
    });

  if (rpcError) {
    logger.error("Failed to write mining source config", {
      miningId,
      sourceId: outcome.sourceId,
      error: rpcError.message,
    });
    return c.json({ error: "Failed to record mining completion" }, 500);
  }

  logger.info("Recorded mining completion", {
    miningId,
    sourceId: outcome.sourceId,
    folders: outcome.patch.mining.last.folders_mined,
  });
  return c.json({ ok: true });
});

Deno.serve((req) => app.fetch(req));
