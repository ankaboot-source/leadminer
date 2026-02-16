import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { notifyLeadminerOfCampaign } from "./notify-leadminer/index.ts";

const functionName = "campaign";
const app = new Hono().basePath(`/${functionName}`);

app.options("/notify-leadminer", cors()); // From Frontend
app.post("/notify-leadminer", cors(), async (c: Context) => {
  const { email, contactsCount } = await c.req.json();
  console.log({ email, contactsCount });

  if (!email) {
    return c.json({ error: "Missing user email" }, 400);
  }

  try {
    await notifyLeadminerOfCampaign(email, contactsCount);
    return c.json({ msg: "Email sent successfully" });
  } catch (error) {
    console.error("Error in mining-complete:", error);
    return c.json({ error: "Failed to send email" }, 500);
  }
});

Deno.serve((req: Request) => app.fetch(req));
