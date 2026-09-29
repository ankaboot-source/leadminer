import { decode } from 'html-entities';

/**
 * HTML -> plain text conversion for campaign emails.
 *
 * The plain-text part of a multipart/alternative email is what mail clients
 * such as Gmail use to build the inbox snippet (preheader). The rich-text
 * editor encodes non-breaking spaces as `&nbsp;`; without decoding, those
 * entities leak literally into the snippet.
 *
 * `html-entities` covers the full HTML5 named/numeric entity set, decodes a
 * single level (so `&amp;nbsp;` stays escaped), and is prototype-safe.
 *
 * NOTE: this mirrors supabase/functions/email-campaigns/html-text.ts. The two
 * runtimes cannot share a module, so keep the implementations in sync.
 */

export function decodeHtmlEntities(value: string): string {
  // Non-breaking spaces are normalized to regular spaces for plain text.
  return decode(value, { scope: 'attribute' }).replace(/\u00a0/gu, ' ');
}

export function htmlToPlainText(html: string): string {
  if (!html) return '';
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^<>]*>/g, ' ');

  return decodeHtmlEntities(withBreaks)
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
