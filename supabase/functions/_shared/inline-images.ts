export type InlineImageAttachment = {
  filename: string;
  content: string;
  encoding: "base64";
  cid: string;
  contentType: string;
  disposition: "inline";
};

type InlineImageTransformResult = {
  html: string;
  attachments: InlineImageAttachment[];
};

const DATA_IMAGE_SRC_REGEX =
  /src\s*=\s*(["'])(data:image\/([a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\r\n]+))\1/gi;

function extensionFromMime(mimeSubtype: string): string {
  const normalized = mimeSubtype.toLowerCase();
  if (normalized === "jpeg") return "jpg";
  if (normalized === "svg+xml") return "svg";
  return normalized;
}

export function inlineDataImagesAsCid(
  html: string,
): InlineImageTransformResult {
  if (!html.includes("data:image/")) {
    return { html, attachments: [] };
  }

  let index = 0;
  const attachments: InlineImageAttachment[] = [];
  const cidByPayload = new Map<string, string>();

  const rewrittenHtml = html.replace(
    DATA_IMAGE_SRC_REGEX,
    (
      full,
      quote: string,
      _dataUri: string,
      mimeSubtype: string,
      payload: string,
    ) => {
      const normalizedPayload = payload.replace(/\s+/g, "");
      if (!normalizedPayload) {
        return full;
      }

      let cid = cidByPayload.get(normalizedPayload);
      if (!cid) {
        index += 1;
        cid = `inline-image-${index}@leadminer`;
        cidByPayload.set(normalizedPayload, cid);
        attachments.push({
          filename: `inline-image-${index}.${extensionFromMime(mimeSubtype)}`,
          content: normalizedPayload,
          encoding: "base64",
          cid,
          contentType: `image/${mimeSubtype.toLowerCase()}`,
          disposition: "inline",
        });
      }

      return `src=${quote}cid:${cid}${quote}`;
    },
  );

  return {
    html: rewrittenHtml,
    attachments,
  };
}
