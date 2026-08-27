import { Context, Hono } from "npm:hono@4.7.4";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { getFolders } from "./boxes.ts";
const supabase = createSupabaseAdmin();

const SERVER_ENDPOINT = Deno.env.get("SERVER_ENDPOINT");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // Edge Functions have access to this secret by default

const functionName = "passive-mining";
const app = new Hono().basePath(`/${functionName}`);

type MiningSource = {
  id: string;
  email: string;
  user_id: string;
  config?: Record<string, unknown>;
};

type PassiveMiningStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed";

function mergeConfig(
  current: MiningSource["config"],
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(current ?? {}), ...patch };
}

async function updateConfig(
  sourceId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const source = await supabase
    .schema("private")
    .from("mining_sources")
    .select("config")
    .eq("id", sourceId)
    .single();
  if (source.error) {
    console.error(
      `Failed to fetch config for ${sourceId}: ${source.error.message}`,
    );
    return;
  }
  const merged = mergeConfig(source.data?.config as MiningSource["config"], patch);
  const { error } = await supabase
    .schema("private")
    .from("mining_sources")
    .update({ config: merged })
    .eq("id", sourceId);
  if (error) {
    console.error(`Failed to persist config for ${sourceId}: ${error.message}`);
  }
}

async function recordRun(
  sourceId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await updateConfig(sourceId, {
    last_run: new Date().toISOString(),
    ...patch,
  });
}

app.post("/", async (c: Context) => {
  try {
    const miningSources = await getMiningSources();
    console.log(`Found ${miningSources.length} mining sources:`, miningSources);
    for (const miningSource of miningSources) {
      try {
        await recordRun(miningSource.id, { status: "running" });
        const { task, folders } = await startMiningEmail(miningSource);
        await recordRun(miningSource.id, {
          status: "completed",
          mining_id: (task as { miningId?: string } | undefined)?.miningId
            ?? null,
          folders_mined: folders,
          errors: [],
        });
        console.log(
          `Started mining task for source ${miningSource.email}:`,
          task,
        );
      } catch (error) {
        console.error(
          `Error starting mining for source ${miningSource.email}:`,
          error,
        );
        await recordRun(miningSource.id, {
          status: "failed",
          errors: [error instanceof Error ? error.message : String(error)],
        });
        // Disable passive mining for failing sources so the scheduler does
        // not retry a broken source on every cycle and silently stall
        // continuous extraction. The user sees and can re-enable it from the
        // sources page.
        await supabase
          .schema("private")
          .from("mining_sources")
          .update({ passive_mining: false })
          .eq("id", miningSource.id)
          .catch((updateError: unknown) => {
            console.error(
              `Failed to disable passive-mining for ${miningSource.email}:`,
              updateError,
            );
          });
      }
    }

    return c.json({ msg: "Started passive-mining" });
  } catch (error) {
    console.error("Error in passive-mining:", error);
    return c.json({ error: "Failed to start passive-mining" }, 500);
  }
});

Deno.serve((req) => app.fetch(req));

async function getMiningSources() {
  const { data, error } = await supabase
    .schema("private")
    .from("mining_sources")
    .select("id, email, user_id, config")
    .match({ passive_mining: true });

  if (error) {
    console.error("Error fetching mining sources:", error.message);
    throw error;
  }

  return data;
}

async function getLatestPassiveMiningDate(
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .schema("private")
    .from("tasks")
    .select("started_at")
    .eq("user_id", userId)
    .eq("type", "fetch")
    .eq("status", "done")
    .contains("details", { passive_mining: true })
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching latest passive mining date:", error.message);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0].started_at;
}

async function getBoxes(miningSource: MiningSource) {
  console.log(
    `Fetching IMAP boxes for ${miningSource.email}at ${SERVER_ENDPOINT}/api/imap/boxes?userId=${miningSource.user_id}`,
  );
  const res = await fetch(
    `${SERVER_ENDPOINT}/api/imap/boxes?userId=${miningSource.user_id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        // originally its x-sb-jwt
      },
      body: JSON.stringify({ email: miningSource.email }),
    },
  );
  console.log(`Received response for boxes of ${miningSource.email}:`, res);

  if (!res.ok) {
    throw new Error(res.statusText);
  }
  const { folders } = (await res.json()).data || {};
  return [...folders];
}

async function startMiningEmail(miningSource: MiningSource) {
  // Get default folders
  // we should save checked boxes from the frontend in miningSource later on
  const boxes = await getBoxes(miningSource);
  console.log(`Fetched boxes for ${miningSource.email}:`, boxes);
  const folders = getFolders(boxes);
  console.log(`Extracted folders for ${miningSource.email}:`, folders);

  const since = await getLatestPassiveMiningDate(miningSource.user_id);

  const sourceConfig = miningSource.config ?? {};
  const googleContactsSync = sourceConfig.google_contacts_sync ?? false;

  const res = await fetch(
    `${SERVER_ENDPOINT}/api/imap/mine/email/${miningSource.user_id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        miningSource: { id: miningSource.id },
        boxes: folders,
        cleaningEnabled: sourceConfig.cleaning_enabled ?? true,
        extractSignatures: sourceConfig.extract_signatures ?? false,
        since,
        passive_mining: true,
        googleContactsSync,
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error("Mining API error:", errText);
    throw new Error("Failed to start mining email");
  }

  const json = await res.json();
  return { task: json?.data ?? json, folders };
}
