import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { personBodySchema } from "./schemas.ts";

Deno.test("personBodySchema: preserves updateEmptyFieldsOnly", () => {
  const parsed = personBodySchema.parse({
    email: "a@b.com",
    updateEmptyFieldsOnly: false,
  });

  assertEquals(parsed.updateEmptyFieldsOnly, false);
});

Deno.test("personBodySchema: leaves updateEmptyFieldsOnly undefined when omitted", () => {
  const parsed = personBodySchema.parse({ email: "a@b.com" });

  assertEquals(parsed.updateEmptyFieldsOnly, undefined);
});
