import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import corsHeaders from "../_shared/cors.ts";
import { buildRedirectResponse } from "../_shared/http.ts";

Deno.test("buildRedirectResponse returns redirect with cors headers", () => {
  const location = "https://example.com/redirect";
  const response = buildRedirectResponse(location);

  assertEquals(response.status, 302);
  assertEquals(response.headers.get("Location"), location);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    assertEquals(response.headers.get(key), value);
  });
});
