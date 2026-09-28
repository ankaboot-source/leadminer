/**
 * HTML -> plain text conversion for campaign emails.
 *
 * The plain-text part of a multipart/alternative email is what mail clients
 * such as Gmail use to build the inbox snippet (preheader). Rich-text HTML
 * produced by the composer editor encodes non-breaking spaces as `&nbsp;`;
 * without decoding, those entities leak literally into the snippet.
 */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function codePointToString(codePoint: number): string {
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return "";
  }
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return "";
  }
}

export function decodeHtmlEntities(value: string): string {
  return (
    value
      .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
        codePointToString(parseInt(hex, 16)),
      )
      .replace(/&#(\d+);/g, (_, dec: string) => codePointToString(Number(dec)))
      // Single pass over named entities, including `amp`, so that a
      // double-encoded string such as `&amp;nbsp;` is only decoded once.
      .replace(/&([a-z][a-z0-9]*);/gi, (match, name: string) => {
        const key = name.toLowerCase();
        return Object.hasOwn(NAMED_ENTITIES, key) ? NAMED_ENTITIES[key] : match;
      })
  );
}

export function htmlToPlainText(html: string): string {
  if (!html) return "";
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^<>]*>/g, " ");

  return decodeHtmlEntities(withBreaks)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}