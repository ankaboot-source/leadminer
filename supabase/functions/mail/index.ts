import { Hono } from "hono";
import mailMiningSuccess from "./mining-success";

const functionName = "mail";
const app = new Hono().basePath(`/${functionName}`);

app.post("/mining-success", mailMiningSuccess);

Deno.serve((req) => {
  return app.fetch(req);
});
