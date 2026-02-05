import { Context, Hono } from "npm:hono@4.7.4";

const functionName = "passive-mining";
const app = new Hono().basePath(`/${functionName}`);

app.post("/", (c: Context) => {
  try {
    return c.json({ msg: "Started passive-mining" });
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
