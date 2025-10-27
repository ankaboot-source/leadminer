import { Context, Hono } from "hono";
import { verifyServiceRole } from "../_shared/middlewares.ts";
import mailMiningComplete from "./mining-complete/index.ts";

const functionName = "mail";
const app = new Hono().basePath(`/${functionName}`);

app.use("*", verifyServiceRole);

app.post("/mining-complete", async (c: Context) => {
  const { miningId } = await c.req.json();

  if (!miningId) {
    return c.json({ error: "Missing miningId" }, 400);
  }

  try {
    await mailMiningComplete(miningId);
    return c.json({ msg: "Email sent successfully" });
  } catch (error) {
    console.error("Error in mining-complete:", error);
    return c.json({ error: "Failed to send email" }, 500);
  }
});

Deno.serve((req) => app.fetch(req));
