import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { inlineDataImagesAsCid } from "./inline-images.ts";

Deno.test(
  "inlineDataImagesAsCid converts data image sources to cid attachments",
  () => {
    const html = '<p><img src="data:image/png;base64,QUJDRA==" alt="x" /></p>';
    const result = inlineDataImagesAsCid(html);

    assertEquals(result.attachments.length, 1);
    assertEquals(result.attachments[0].encoding, "base64");
    assertEquals(result.attachments[0].contentType, "image/png");
    assertEquals(
      result.html.includes('src="cid:inline-image-1@leadminer"'),
      true,
    );
  },
);

Deno.test("inlineDataImagesAsCid reuses same cid for duplicate payload", () => {
  const dataUri = "data:image/jpeg;base64,QUJDREVGRw==";
  const html = `<img src="${dataUri}" /><img src="${dataUri}" />`;
  const result = inlineDataImagesAsCid(html);

  assertEquals(result.attachments.length, 1);
  assertEquals(result.html.match(/cid:inline-image-1@leadminer/g)?.length, 2);
});
