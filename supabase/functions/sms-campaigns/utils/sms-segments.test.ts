import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

function calculateSmsParts(message: string, includeFooter = true): { parts: number; encoding: string; charCount: number } {
  const FOOTER_LENGTH = '\n\nUnsubscribe me: https://example.com'.length;
  const totalLength = message.length + (includeFooter ? FOOTER_LENGTH : 0);
  
  const isUnicode = /[^\u0000-\u007F]/.test(message);
  const encoding = isUnicode ? 'Unicode' : 'GSM-7';
  
  const maxPerSms = isUnicode ? 70 : 160;
  const parts = Math.ceil(totalLength / maxPerSms) || 1;
  
  return { parts, encoding, charCount: totalLength };
}

Deno.test("calculateSmsParts returns GSM-7 for ASCII only", () => {
  const result = calculateSmsParts("Hello world");
  assertEquals(result.encoding, "GSM-7");
});

Deno.test("calculateSmsParts returns Unicode for special chars", () => {
  const result = calculateSmsParts("Hello café");
  assertEquals(result.encoding, "Unicode");
});

Deno.test("calculateSmsParts returns correct parts for GSM-7", () => {
  const short = calculateSmsParts("Hi");
  assertEquals(short.parts, 1);
  
  const medium = calculateSmsParts("A".repeat(150));
  assertEquals(medium.parts, 1);
  
  const long = calculateSmsParts("A".repeat(161));
  assertEquals(long.parts, 2);
});

Deno.test("calculateSmsParts returns correct parts for Unicode", () => {
  const short = calculateSmsParts("Hi");
  assertEquals(short.parts, 1);
  
  const medium = calculateSmsParts("é".repeat(65));
  assertEquals(medium.parts, 1);
  
  const long = calculateSmsParts("é".repeat(71));
  assertEquals(long.parts, 2);
});

Deno.test("calculateSmsParts includes footer in count", () => {
  const withoutFooter = calculateSmsParts("Test", false);
  const withFooter = calculateSmsParts("Test", true);
  
  assertEquals(withFooter.charCount, withoutFooter.charCount + 45);
});

Deno.test("calculateSmsParts handles empty message", () => {
  const result = calculateSmsParts("");
  assertEquals(result.parts, 1);
  assertEquals(result.charCount, 45);
});

Deno.test("calculateSmsParts handles emoji", () => {
  const result = calculateSmsParts("Hello 👋");
  assertEquals(result.encoding, "Unicode");
  assertEquals(result.parts, 1);
});