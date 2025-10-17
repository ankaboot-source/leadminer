import { Context, Hono } from "hono";
import mailMiningComplete from "./mining-complete/index.ts";

const functionName = "mail";
const app = new Hono().basePath(`/${functionName}`);

app.post("/mining-complete", async (c: Context) => {
  const { userID, miningId } = await c.req.json();
  try {
    await mailMiningComplete(userID, miningId);
    return c.json({ msg: "Email sent successfully" });
  } catch (error) {
    console.error("Error in mining-success endpoint:", error);
    return c.json({ error: "Failed to send email" }, 500);
  }
});

Deno.serve((req) => {
  return app.fetch(req);
});
