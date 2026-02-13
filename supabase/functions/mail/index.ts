import { Context, Hono } from "hono";
import corsHeaders from "../_shared/cors.ts";
import { verifyServiceRole } from "../_shared/middlewares.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";
import mailMiningComplete from "./mining-complete/index.ts";
import { sendEmail } from "./utils/email.ts";

const functionName = "mail";
const app = new Hono().basePath(`/${functionName}`);

app.use("*", async (c, next) => {
  await next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
});

app.options("*", () => new Response("ok", { headers: corsHeaders }));

app.post("/mining-complete", verifyServiceRole, async (c: Context) => {
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

app.post("/email-sending-request", async (c: Context) => {
  const authorization = c.req.header("authorization");

  if (!authorization) {
    return c.json({ error: "Missing authorization header" }, 401);
  }

  const supabase = createSupabaseClient(authorization);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { contactsCount } = await c.req.json().catch(() => ({}));
  if (!Number.isInteger(contactsCount) || contactsCount < 1) {
    return c.json({ error: "Invalid contactsCount" }, 400);
  }

  const subject = "Email sending request";
  const safeUserEmail = escapeHtml(user.email);
  const html = `<p>The user ${safeUserEmail} wants to send his ${contactsCount} contacts by email</p>`;

  try {
    await sendEmail(
      "contact@leadminer.io",
      subject,
      html,
      {
        from: "contact@leadminer.io",
        replyTo: user.email,
      },
    );

    return c.json({ msg: "Email sent successfully" });
  } catch (error) {
    console.error("Error in email-sending-request:", error);
    return c.json({ error: "Failed to send email" }, 500);
  }
});

Deno.serve((req) => app.fetch(req));
