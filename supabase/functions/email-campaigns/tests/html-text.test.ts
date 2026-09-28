import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decodeHtmlEntities, htmlToPlainText } from "../html-text.ts";

Deno.test("htmlToPlainText decodes &nbsp; into a regular space", () => {
  assertEquals(htmlToPlainText("<p>Les&nbsp;amis</p>"), "Les amis");
});

Deno.test("htmlToPlainText decodes common named entities", () => {
  assertEquals(
    htmlToPlainText(
      "<p>Tom &amp; Jerry &lt;3 &gt;. &quot;Hi&quot; &#39;ok&#39;</p>",
    ),
    "Tom & Jerry <3 >. \"Hi\" 'ok'",
  );
});

Deno.test("htmlToPlainText decodes numeric and hex entities", () => {
  assertEquals(htmlToPlainText("<p>caf&#233; &#xe9;t&#233;</p>"), "café été");
});

Deno.test("htmlToPlainText converts paragraph boundaries to newlines", () => {
  assertEquals(htmlToPlainText("<p>one</p><p>two</p>"), "one\n\ntwo");
});

Deno.test("htmlToPlainText collapses repeated whitespace and trims", () => {
  assertEquals(htmlToPlainText("<p>  a   b </p>"), "a b");
});

Deno.test("htmlToPlainText decodes entities only once (double-encoded stays escaped)", () => {
  assertEquals(htmlToPlainText("<p>&amp;nbsp;</p>"), "&nbsp;");
});

Deno.test("htmlToPlainText leaves unknown named entities untouched", () => {
  assertEquals(htmlToPlainText("<p>&copy; 2026</p>"), "&copy; 2026");
});

Deno.test("decodeHtmlEntities handles &nbsp; and &amp;", () => {
  assertEquals(decodeHtmlEntities("a&nbsp;b&amp;c"), "a b&c");
});

Deno.test("regression: preheader text contains no literal &nbsp;", () => {
  const html =
    "<p>Les&nbsp;amis,&nbsp;la&nbsp;famille,&nbsp;chers&nbsp;amis,</p>" +
    "<p>Face à l'injustice, nous restons unis.</p>";
  const text = htmlToPlainText(html);
  assertEquals(text.includes("&nbsp;"), false);
  assertStringIncludes(text, "Les amis, la famille, chers amis,");
});

Deno.test("decodeHtmlEntities does not resolve Object.prototype members", () => {
  assertEquals(decodeHtmlEntities("&constructor;"), "&constructor;");
  assertEquals(decodeHtmlEntities("&toString;"), "&toString;");
});

Deno.test("htmlToPlainText preserves stray '<' text and does not hang", () => {
  assertEquals(htmlToPlainText("<p>a < b</p>"), "a < b");
  // Malformed input with many '<' must not blow up (linear-time tag strip).
  const malformed = "<a".repeat(20000);
  assertEquals(typeof htmlToPlainText(malformed), "string");
});