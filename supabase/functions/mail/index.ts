import { z } from "zod";
import { Context, Hono } from "hono";
import mailMiningComplete from "./mining-complete/index.ts";
import sendWeeklyPassiveMiningReports from "./weekly-passive-report/index.ts";
import { verifyServiceRole } from "../_shared/middlewares.ts";
import { validationErrorBody } from "../_shared/validation.ts";

const functionName = "mail";
const app = new Hono().basePath(`/${functionName}`);

const miningIdSchema = z.string().min(1, "Missing miningId");
const weekStartSchema = z.string().min(1, "Missing weekStart");

app.options("/mining-complete", verifyServiceRole); // From Backend only
app.post("/mining-complete", verifyServiceRole, async (c: Context) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = miningIdSchema.safeParse(body.miningId);

  if (!parsed.success) {
    return c.json(validationErrorBody(parsed.error), 400);
  }

  try {
    await mailMiningComplete(parsed.data);
    return c.json({ msg: "Email sent successfully" });
  } catch (error) {
    console.error("Error in mining-complete:", error);
    return c.json({ error: "Failed to send email" }, 500);
  }
});
app.post("/send-weekly-passive-mining-reports", async (c: Context) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = weekStartSchema.safeParse(body.weekStart);

  if (!parsed.success) {
    return c.json(validationErrorBody(parsed.error), 400);
  }

  try {
    const result = await sendWeeklyPassiveMiningReports(parsed.data);
    return c.json({ 
      msg: "Weekly passive mining reports job completed",
      ...result 
    });
  } catch (error) {
    console.error("Error in send-weekly-passive-mining-reports:", error);
    return c.json({ error: "Failed to process weekly reports" }, 500);
  }
});

Deno.serve((req: Request) => app.fetch(req));
