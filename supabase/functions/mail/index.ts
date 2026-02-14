import { Context, Hono } from "hono";
import { verifyServiceRole } from "../_shared/middlewares.ts";
import sendWeeklyPassiveMiningReports from "./weekly-passive-report/index.ts";
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

app.post("/send-weekly-passive-mining-reports", async (c: Context) => {
  const { weekStart } = await c.req.json();

  if (!weekStart) {
    return c.json({ error: "Missing weekStart" }, 400);
  }

  try {
    const result = await sendWeeklyPassiveMiningReports(weekStart);
    return c.json({ 
      msg: "Weekly passive mining reports job completed",
      ...result 
    });
  } catch (error) {
    console.error("Error in send-weekly-passive-mining-reports:", error);
    return c.json({ error: "Failed to process weekly reports" }, 500);
  }
});

Deno.serve((req) => app.fetch(req));
