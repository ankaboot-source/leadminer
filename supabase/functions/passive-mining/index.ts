import { Context, Hono } from "npm:hono@4.7.4";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { getFolders } from "./boxes.ts";
const supabase = createSupabaseAdmin();

const SERVER_ENDPOINT = Deno.env.get("SERVER_ENDPOINT");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // Edge Functions have access to this secret by default

const functionName = "passive-mining";
const app = new Hono().basePath(`/${functionName}`);

type MiningSource = {
  email: string;
  user_id: string;
};
app.post("/", async (c: Context) => {
  try {
    const miningSources = await getMiningSources();
    console.log(`Found ${miningSources.length} mining sources:`, miningSources);
    for (const miningSource of miningSources) {
      try {
        const miningTask = await startMiningEmail(miningSource);
        console.log(
          `Started mining task for source ${miningSource.email}:`,
          miningTask,
        );
      } catch (error) {
        console.error(
          `Error starting mining for source ${miningSource.email}:`,
          error,
        );
        // feedback to sources that passive mining failed, passive_mining.enabled=false, error="string" else null
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
    .select("email, user_id")
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

  const res = await fetch(
    `${SERVER_ENDPOINT}/api/imap/mine/email/${miningSource.user_id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        miningSource: { email: miningSource.email },
        boxes: folders,
        extractSignatures: false,
        since,
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error("Mining API error:", errText);
    throw new Error("Failed to start mining email");
  }

  const json = await res.json();
  return json?.data ?? json;
}
