import Encoding from 'encoding-japanese';
import { FetchMessageObject, MessageStructureObject } from 'imapflow';
import { decodeQuotedPrintable } from 'lettercoder';
import iconv from 'iconv-lite';

/**
 * Recursively find the first text/plain part ID in an IMAP BODYSTRUCTURE.
 * @param node - The BODYSTRUCTURE object returned by ImapFlow
 * @returns The part ID string (e.g., "1.2") or null if not found
 */
export function findPlainTextNode(
  node?: MessageStructureObject
): MessageStructureObject | null {
  if (!node) return null;

  const type = (node.type || '').toLowerCase();

  if (type === 'text/plain') {
    return node || null;
  }

  if (Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) {
      const result = findPlainTextNode(child);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Groups IMAP messages by their text/plain part.
 * Returns an array of ([[partId]] | undefined, Set<UID>) tuples.
 * - The partId is wrapped in an array for compatibility with downstream consumers.
 * - Returns undefined when no valid text/plain node or node exceeds max size.
 */
export function groupMessagesByTextPart(
  messages: Iterable<FetchMessageObject>,
  maxBodyTextSize?: number
): [string[] | undefined, Set<number | string>][] {
  const textPlainMap = new Map<string, Set<number | string>>();

  for (const { uid, bodyStructure } of messages) {
    const node = findPlainTextNode(bodyStructure);
    const size = node?.size ?? 0;

    let key: string | undefined = node?.part ? node.part : '__no_text__';
    if (!node || (maxBodyTextSize && size > maxBodyTextSize)) {
      key = '__no_text__';
    }

    if (!textPlainMap.has(key)) {
      textPlainMap.set(key, new Set());
    }
    textPlainMap.get(key)!.add(uid);
  }

  return Array.from(textPlainMap.entries()).map(([partId, uids]) => [
    partId === '__no_text__' ? undefined : [partId],
    uids
  ]);
}

export function decodeTextPart(
  buffer: Buffer<ArrayBufferLike>,
  charset = 'utf-8',
  transferEncoding = '7bit'
): string {
  const encoding = transferEncoding?.toLowerCase() ?? '7bit';
  const charsetNorm = (charset || 'ascii').toString().trim().toLowerCase();

  let bytes = buffer;
  switch (encoding) {
    case 'base64':
      bytes = Buffer.from(
        buffer.toString('ascii').trim().replace(/\s+/g, ''),
        'base64'
      );
      break;

    case 'quoted-printable':
      bytes = Buffer.from(decodeQuotedPrintable(buffer.toString('latin1')));
      break;

    default:
      break;
  }

  let text: string;
  try {
    if (/^jis|^iso-?2022-?jp|^eucjp/i.test(charsetNorm)) {
      text = Encoding.convert(bytes, {
        from: charsetNorm.toUpperCase() as Encoding.Encoding,
        to: 'UNICODE',
        type: 'string'
      });
    } else {
      text = iconv.decode(bytes, charsetNorm);
    }
  } catch {
    text = bytes.toString('utf-8');
  }
  return text;
}
