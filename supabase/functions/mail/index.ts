import { z } from "zod";
import { Context, Hono } from "hono";
import mailMiningComplete from "./mining-complete/index.ts";
import mailPassiveMiningFailure from "./passive-mining-failed/index.ts";
import sendWeeklyPassiveMiningReports from "./weekly-passive-report/index.ts";
import { verifyServiceRole } from "../_shared/middlewares.ts";
import { validationErrorBody } from "../_shared/validation.ts";

const functionName = "mail";
const app = new Hono().basePath(`/${functionName}`);

const miningIdSchema = z.string().min(1, "Missing miningId");
const weekStartSchema = z.string().min(1, "Missing weekStart");
const passiveMiningFailureSchema = z.object({
  userId: z.string().uuid(),
  sourceEmail: z.string().trim().min(1).max(255),
});

app.options("/passive-mining-failed", verifyServiceRole);
app.post("/passive-mining-failed", verifyServiceRole, async (c: Context) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = passiveMiningFailureSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(validationErrorBody(parsed.error), 400);
  }

  try {
    await mailPassiveMiningFailure(parsed.data.userId, parsed.data.sourceEmail);
    return c.json({ msg: "Email sent successfully" });
  } catch (error) {
    console.error("Error in passive-mining-failed:", error);
    return c.json({ error: "Failed to send email" }, 500);
  }
});

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
      ...result,
    });
  } catch (error) {
    console.error("Error in send-weekly-passive-mining-reports:", error);
    return c.json({ error: "Failed to process weekly reports" }, 500);
  }
});

Deno.serve((req: Request) => app.fetch(req));
