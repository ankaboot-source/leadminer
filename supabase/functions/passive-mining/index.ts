import { Context, Hono } from "npm:hono@4.7.4";
import { createSupabaseAdmin } from "../../_shared/supabase.ts";
const supabase = createSupabaseAdmin();

const functionName = "passive-mining";
const app = new Hono().basePath(`/${functionName}`);

//!
app.post("/", async (c: Context) => {
  try {
    return c.json({ msg: "Started passive-mining" });
    const miningSources = await getMiningSources();
    // 1. for every source
    // 2. fetch boxes and keep latest emails (since last cron job for example)
    // 3. startMining: /mine/email/:userId
    //  const body = {
    //         miningSource: {
    //           email: source.email,;
    //         };
    //         boxes: string[];
    //         extractSignatures: false;
    //       };
  } catch (error) {
    console.error("Error in passive-mining:", error);
    return c.json({ error: "Failed to send email" }, 500);
  }
});

app.get("/", (c: Context) => {
  try {
    return c.json({ msg: "Passive mining is running" });
  } catch (error) {
    console.error("Error in passive-mining:", error);
    return c.json({ error: "Failed to send email" }, 500);
  }
});

Deno.serve((req) => app.fetch(req));

async function getMiningSources() {
  const { data, error } = await supabase
    .schema("private")
    .from("mining_sources")
    .select("*")
    .match({ passive_mining: true });

  if (error) {
    console.error("Error fetching mining sources:", error.message);
    throw error;
  }

  return data;
}
