import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveValidPhones } from "../middlewares-mod.ts";

Deno.test(
  "resolveValidPhones - dedupes and normalizes to E.164 with region",
  () => {
    const phones = resolveValidPhones({
      selectedRecipients: [
        { phone: "21697522154" },
        { phone: "+216 97 522 154" },
        { phone: "nope" },
      ],
      timezone: "Africa/Tunis",
    });
    assertEquals(phones, ["+21697522154"]);
  },
);

Deno.test(
  "resolveValidPhones - falls back to selectedPhones when no recipients",
  () => {
    const phones = resolveValidPhones({
      selectedPhones: ["+33123456789", "+33123456789"],
    });
    assertEquals(phones, ["+33123456789"]);
  },
);

Deno.test("resolveValidPhones - returns empty when no valid numbers", () => {
  const phones = resolveValidPhones({ selectedPhones: ["abc", "42"] });
  assertEquals(phones, []);
});
