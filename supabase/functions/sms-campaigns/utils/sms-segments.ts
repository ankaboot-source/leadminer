const FOOTER_TEMPLATE = "\n\nUnsubscribe me: https://example.com";

export function estimateSmsSegments(
  message: string,
  includeFooter: boolean,
): { charCount: number; encoding: "GSM-7" | "Unicode"; parts: number } {
  const base = message || "";
  const totalLength =
    base.length + (includeFooter ? FOOTER_TEMPLATE.length : 0);
  const isUnicode = /[^\u0000-\u007F]/.test(base);
  const encoding = isUnicode ? "Unicode" : "GSM-7";
  const maxPerSms = isUnicode ? 70 : 160;
  const parts = Math.max(1, Math.ceil(totalLength / maxPerSms));

  return {
    charCount: totalLength,
    encoding,
    parts,
  };
}
