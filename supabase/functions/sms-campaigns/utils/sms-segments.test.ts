import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { estimateSmsSegments } from "./sms-segments.ts";

Deno.test("estimateSmsSegments returns GSM-7 for ASCII only", () => {
  const result = estimateSmsSegments("Hello world", true);
  assertEquals(result.encoding, "GSM-7");
});

Deno.test("estimateSmsSegments returns Unicode for special chars", () => {
  const result = estimateSmsSegments("Hello café", true);
  assertEquals(result.encoding, "Unicode");
});

Deno.test("estimateSmsSegments includes footer in count", () => {
  const withoutFooter = estimateSmsSegments("Test", false);
  const withFooter = estimateSmsSegments("Test", true);
  const footerLength = "\n\nUnsubscribe me: https://example.com".length;

  assertEquals(withFooter.charCount, withoutFooter.charCount + footerLength);
});

Deno.test("estimateSmsSegments handles part calculation", () => {
  const short = estimateSmsSegments("Hi", true);
  assertEquals(short.parts, 1);

  const long = estimateSmsSegments("A".repeat(200), true);
  assertEquals(long.parts >= 2, true);
});
