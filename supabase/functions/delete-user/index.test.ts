import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

const { app } = await import("./index.ts");

Deno.test("module loads without errors", () => {
  assertEquals(typeof app, "object");
});

Deno.test("DELETE / returns 401 without Authorization header", async () => {
  const req = new Request("http://localhost/delete-user", { method: "DELETE" });
  const res = await app.fetch(req);
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "Missing Authorization header");
});

Deno.test({
  name: "DELETE / returns 401 with invalid Bearer token",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const req = new Request("http://localhost/delete-user", {
      method: "DELETE",
      headers: { authorization: "Bearer invalid-token" },
    });
    const res = await app.fetch(req);
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "Unauthorized");
  },
});

Deno.test({
  name: "DELETE / returns 401 with empty Bearer token",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const req = new Request("http://localhost/delete-user", {
      method: "DELETE",
      headers: { authorization: "Bearer " },
    });
    const res = await app.fetch(req);
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "Unauthorized");
  },
});
