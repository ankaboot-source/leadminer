import { Context, Hono } from "npm:hono@4.7.4";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { verifyServiceRole } from "../_shared/middlewares.ts";
import { createLogger } from "../_shared/logger.ts";
import { getFolders } from "./boxes.ts";
const supabase = createSupabaseAdmin();
const logger = createLogger("passive-mining");

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
app.post("/", verifyServiceRole, async (c: Context) => {
  try {
    const miningSources = await getMiningSources();
    logger.info(`Found ${miningSources.length} mining sources`, {
      count: miningSources.length,
    });
    for (const miningSource of miningSources) {
      try {
        const miningTask = await startMiningEmail(miningSource);
        logger.info(`Started mining task for source`, {
          email: miningSource.email,
          miningTask,
        });
      } catch (error) {
        logger.error(`Error starting mining for source`, {
          email: miningSource.email,
          error: String(error),
        });
        // feedback to sources that passive mining failed, passive_mining.enabled=false, error="string" else null
      }
    }

    return c.json({ msg: "Started passive-mining" });
  } catch (error) {
    logger.error("Error in passive-mining", { error: String(error) });
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
    logger.error("Error fetching mining sources", { error: error.message });
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
    logger.error("Error fetching latest passive mining date", {
      error: error.message,
    });
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0].started_at;
}

async function getBoxes(miningSource: MiningSource) {
  logger.info("Fetching IMAP boxes", {
    email: miningSource.email,
    userId: miningSource.user_id,
  });
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
  logger.info("Received response for boxes", { email: miningSource.email });

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
  logger.info("Fetched boxes", { email: miningSource.email });
  const folders = getFolders(boxes);
  logger.info("Extracted folders", { email: miningSource.email });

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
    logger.error("Mining API error", { error: errText });
    throw new Error("Failed to start mining email");
  }

  const json = await res.json();
  return json?.data ?? json;
}
