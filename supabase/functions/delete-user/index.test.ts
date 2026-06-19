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

Deno.test({
  name: "DELETE / deletes user data via authenticated client and auth user via admin",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const userId = "user-123";
    const requests: Request[] = [];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);

      if (request.url.endsWith("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: userId }), { status: 200 });
      }

      if (request.url.endsWith("/rest/v1/rpc/delete_user_data")) {
        return new Response(JSON.stringify(null), { status: 200 });
      }

      if (request.url.endsWith(`/auth/v1/admin/users/${userId}`)) {
        return new Response(JSON.stringify({}), { status: 200 });
      }

      return new Response("Not found", { status: 404 });
    };

    try {
      const { app: appUnderTest } = await import(
        `./index.ts?test=${Date.now()}`
      );

      const req = new Request("http://localhost/delete-user", {
        method: "DELETE",
        headers: { authorization: "Bearer valid-token" },
      });
      const res = await appUnderTest.fetch(req);

      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.message, "Successfully deleted user");

      const rpcRequest = requests.find((r) =>
        r.url.endsWith("/rest/v1/rpc/delete_user_data"),
      );
      assertEquals(rpcRequest !== undefined, true);
      assertEquals(rpcRequest?.method, "POST");
      const rpcBody = await rpcRequest?.text();
      assertEquals(rpcBody, "{}");

      const adminDeleteRequest = requests.find((r) =>
        r.url.endsWith(`/auth/v1/admin/users/${userId}`),
      );
      assertEquals(adminDeleteRequest !== undefined, true);
      assertEquals(adminDeleteRequest?.method, "DELETE");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
});
