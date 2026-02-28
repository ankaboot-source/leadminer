import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeEmail } from "./email.ts";

Deno.test("normalizeEmail trims and lowercases", () => {
  assertEquals(
    normalizeEmail("  Bader.Lejmi@GMAIL.com "),
    "bader.lejmi@gmail.com",
  );
});
