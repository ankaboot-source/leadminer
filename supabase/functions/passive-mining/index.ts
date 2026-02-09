import { Context, Hono } from "npm:hono@4.7.4";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
const supabase = createSupabaseAdmin();

const functionName = "passive-mining";
const app = new Hono().basePath(`/${functionName}`);

app.post("/", async (c: Context) => {
  try {
    const miningSources = await getMiningSources();

    for (const miningSource of miningSources) {
      const miningTask = await startMiningEmail(
        miningSource,
      );
      console.log(
        `Started mining task for source ${miningSource.id}:`,
        miningTask,
      );
    }

    return c.json({ msg: "Started passive-mining" });
  } catch (error) {
    console.error("Error in passive-mining:", error);
    return c.json({ error: "Failed to start passive-mining" }, 500);
  }
});

app.get("/", (c: Context) => {
  try {
    return c.json({ msg: "Passive mining is running" });
  } catch (error) {
    console.error("Error in passive-mining:", error);
    return c.json({ error: "Failed to check passive-mining" }, 500);
  }
});

Deno.serve((req) => app.fetch(req));

async function getMiningSources() {
  const { data, error } = await supabase
    .schema("private")
    .from("mining_sources")
    .select("email, user_id") // credentials and use it directly, instead of backend recalling db
    .match({ passive_mining: true });

  if (error) {
    console.error("Error fetching mining sources:", error.message);
    throw error;
  }

  return data;
}
async function startMiningEmail(miningSource: any) {
  const SERVER_ENDPOINT = Deno.env.get("SERVER_ENDPOINT");

  if (!SERVER_ENDPOINT) {
    throw new Error("SERVER_ENDPOINT is not defined");
  }

  const res = await fetch(
    `${SERVER_ENDPOINT}/imap/mine/email/${miningSource.user_id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: miningSource.email,
        extractSignatures: false,
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
