import { Context, Hono } from "npm:hono@4.7.4";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
const supabase = createSupabaseAdmin();

const SERVER_ENDPOINT = "postgresql://authenticator:postgres@db:8081";

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
  // const SERVER_ENDPOINT = Deno.env.get("SERVER_ENDPOINT");

  console.log(`${SERVER_ENDPOINT}/api/imap/mine/email/${miningSource.user_id}`);

  const boxes = await getBoxes(miningSource);
  console.log(JSON.stringify({
    miningSource: { email: miningSource.email },
    boxes,
    extractSignatures: false,
  }));

  const res = await fetch(
    `${SERVER_ENDPOINT}/api/imap/mine/email/${miningSource.user_id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LEADMINER_SECRET_TOKEN")}`,
      },
      body: JSON.stringify({
        miningSource: { email: miningSource.email },
        boxes,
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

async function getBoxes(miningSource: any) {
  // const SERVER_ENDPOINT = Deno.env.get("SERVER_ENDPOINT");
  console.log(
    JSON.stringify(
      `${SERVER_ENDPOINT}/api/imap/boxes?userId=${miningSource.user_id}`,
    ),
  );
  const res = await fetch(
    `${SERVER_ENDPOINT}/api/imap/boxes`, //! not found pbbly due edge fucntion localhost probel
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LEADMINER_SECRET_TOKEN")}`,
      },
      body: JSON.stringify({ type: "email", email: miningSource.email }),
    },
  );

  console.log("boxes", res);

  const { folders } = (await res.json()).data || {};
  return [...folders];
}
