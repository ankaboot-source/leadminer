import { MessageStructureObject } from 'imapflow';
import { describe, it, expect } from '@jest/globals';
import {
  findPlainTextNode,
  decodeTextPart
} from '../../../src/services/imap/parsing';

const textPlainNode: MessageStructureObject = {
  part: '1.1',
  type: 'text/plain',
  parameters: { charset: 'utf-8' },
  encoding: '7bit',
  size: 1024,
  childNodes: []
};

const textHtmlNode: MessageStructureObject = {
  part: '1.2',
  type: 'text/html',
  parameters: { charset: 'utf-8' },
  encoding: 'quoted-printable',
  size: 2048,
  childNodes: []
};

const pdfNode: MessageStructureObject = {
  part: '2',
  type: 'application/pdf',
  encoding: 'base64',
  size: 102400,
  disposition: 'attachment',
  dispositionParameters: { filename: 'invoice.pdf' },
  childNodes: []
};

const imageNode: MessageStructureObject = {
  part: '3',
  type: 'image/png',
  encoding: 'base64',
  size: 4096,
  disposition: 'inline',
  dispositionParameters: { filename: 'image.png' },
  childNodes: []
};

const emptyNode: MessageStructureObject = {
  part: '0',
  type: '',
  childNodes: []
};

describe('findPlainTextNode', () => {
  it('should return null for undefined input', () => {
    expect(findPlainTextNode(undefined)).toBeNull();
  });

  it('should return null for empty node', () => {
    expect(findPlainTextNode({} as MessageStructureObject)).toBeNull();
  });

  it('should return the node when it is text/plain', () => {
    expect(findPlainTextNode(textPlainNode)).toBe(textPlainNode);
  });

  it('should return null when type is not text/plain', () => {
    expect(findPlainTextNode(textHtmlNode)).toBeNull();
  });

  it('should find text/plain in a multipart/mixed structure', () => {
    const node: MessageStructureObject = {
      part: '1',
      type: 'multipart/mixed',
      childNodes: [textHtmlNode, textPlainNode, pdfNode]
    };
    expect(findPlainTextNode(node)).toBe(textPlainNode);
  });

  it('should handle deeply nested multipart/alternative structure (real IMAP example)', () => {
    const structure: MessageStructureObject = {
      part: '0',
      type: 'multipart/mixed',
      childNodes: [
        {
          part: '1',
          type: 'multipart/alternative',
          childNodes: [textHtmlNode, textPlainNode]
        },
        pdfNode
      ]
    };
    expect(findPlainTextNode(structure)).toBe(textPlainNode);
  });

  it('should handle multipart/related with embedded image', () => {
    const node: MessageStructureObject = {
      part: '1',
      type: 'multipart/related',
      childNodes: [textHtmlNode, imageNode, textPlainNode]
    };
    expect(findPlainTextNode(node)).toBe(textPlainNode);
  });

  it('should be case-insensitive for type comparison', () => {
    const upperCasePlain: MessageStructureObject = {
      ...textPlainNode,
      type: 'Text/Plain'
    };
    expect(findPlainTextNode(upperCasePlain)).toBe(upperCasePlain);
  });

  it('should skip attachments but still find text/plain', () => {
    const node: MessageStructureObject = {
      part: '1',
      type: 'multipart/mixed',
      childNodes: [pdfNode, textPlainNode]
    };
    expect(findPlainTextNode(node)).toBe(textPlainNode);
  });

  it('should handle node missing childNodes gracefully', () => {
    const node = {
      part: '0',
      type: 'multipart/mixed'
    } as MessageStructureObject;
    expect(findPlainTextNode(node)).toBeNull();
  });

  it('should return the first text/plain if multiple exist', () => {
    const anotherPlain: MessageStructureObject = {
      ...textPlainNode,
      part: '2.2'
    };
    const node: MessageStructureObject = {
      part: '2',
      type: 'multipart/alternative',
      childNodes: [textPlainNode, anotherPlain]
    };
    expect(findPlainTextNode(node)).toBe(textPlainNode);
  });

  it('should return null if no text/plain found anywhere', () => {
    const node: MessageStructureObject = {
      part: '1',
      type: 'multipart/mixed',
      childNodes: [textHtmlNode, pdfNode, imageNode]
    };
    expect(findPlainTextNode(node)).toBeNull();
  });

  it('should ignore empty or invalid type fields', () => {
    const node: MessageStructureObject = {
      part: '1',
      type: 'multipart/mixed',
      childNodes: [emptyNode, pdfNode]
    };
    expect(findPlainTextNode(node)).toBeNull();
  });
});

describe('decodeTextPart', () => {
  it('should handle 7bit encoding with UTF-8 charset', () => {
    const buffer = Buffer.from('Simple text');
    const result = decodeTextPart(buffer, 'utf-8', '7bit');
    expect(result).toBe('Simple text');
  });

  it('should handle base64 encoding (typical email body)', () => {
    const originalText = 'Hello, this is a test email.';
    // Real-world IMAP base64 bodies are often split across lines:
    const base64Content = Buffer.from(originalText, 'utf-8')
      .toString('base64')
      .match(/.{1,76}/g)!
      .join('\r\n');
    const buffer = Buffer.from(base64Content, 'utf-8');

    const result = decodeTextPart(buffer, 'utf-8', 'base64');
    expect(result).toBe(originalText);
  });

  it('should handle base64 with whitespace and line breaks', () => {
    const originalText = 'Another base64 test with breaks.';
    const base64Content = Buffer.from(originalText).toString('base64');
    const withBreaks = `${base64Content.slice(0, 10)}\r\n ${base64Content.slice(10)}`;
    const buffer = Buffer.from(withBreaks, 'utf-8');

    const result = decodeTextPart(buffer, 'utf-8', 'base64');
    expect(result).toBe(originalText);
  });

  it('should handle quoted-printable with spaces and soft breaks', () => {
    // Real-world example from an email body (soft line breaks with "=")
    const qpContent = 'This=20is=20a=20test=0AWith=20line=20breaks=2E=0A';
    const buffer = Buffer.from(qpContent, 'latin1');

    const result = decodeTextPart(buffer, 'utf-8', 'quoted-printable');
    expect(result).toBe('This is a test\nWith line breaks.\n');
  });

  it('should handle ISO-2022-JP encoded text (Japanese email sample)', () => {
    // Example from an actual ISO-2022-JP encoded subject
    // "こんにちは" in ISO-2022-JP
    const jisBytes = Buffer.from('\x1B$B$3$s$K$A$O\x1B(B', 'binary');
    const result = decodeTextPart(jisBytes, 'iso-2022-jp', '7bit');
    expect(result).toBe('こんにちは');
  });

  it('should handle UTF-8 with base64 encoding (multilingual)', () => {
    const originalText = 'Hello 世界 👋';
    const base64Content = Buffer.from(originalText, 'utf-8').toString('base64');
    const buffer = Buffer.from(base64Content, 'utf-8');

    const result = decodeTextPart(buffer, 'utf-8', 'base64');
    expect(result).toBe(originalText);
  });

  it('should fall back to UTF-8 when charset decoding fails', () => {
    const buffer = Buffer.from('test fallback');
    const result = decodeTextPart(buffer, 'invalid-charset', '7bit');
    expect(result).toBe('test fallback');
  });

  it('should handle undefined transferEncoding', () => {
    const buffer = Buffer.from('plain');
    const result = decodeTextPart(buffer, 'utf-8', undefined as any);
    expect(result).toBe('plain');
  });

  it('should handle undefined charset', () => {
    const buffer = Buffer.from('ascii text');
    const result = decodeTextPart(buffer, undefined as any, '7bit');
    expect(result).toBe('ascii text');
  });

  it('should normalize charset casing and whitespace', () => {
    const buffer = Buffer.from('normalization test');
    const result = decodeTextPart(buffer, ' Utf-8 ', '7bit');
    expect(result).toBe('normalization test');
  });

  it('should handle case-insensitive transfer encoding', () => {
    const originalText = 'Case insensitive test';
    const base64Content = Buffer.from(originalText).toString('base64');
    const buffer = Buffer.from(base64Content, 'utf-8');

    const result = decodeTextPart(buffer, 'utf-8', 'BASE64');
    expect(result).toBe(originalText);
  });

  it('should handle empty buffer', () => {
    const buffer = Buffer.from('');
    const result = decodeTextPart(buffer, 'utf-8', '7bit');
    expect(result).toBe('');
  });

  it('should decode Latin-1 encoded words (as used in emails)', () => {
    const originalText = 'café crème';
    const buffer = Buffer.from(originalText, 'latin1');
    const result = decodeTextPart(buffer, 'latin1', '7bit');
    expect(result).toBe(originalText);
  });

  it('should handle Windows-1252 encoded Euro and Pound symbols', () => {
    const euroPound = Buffer.from([0x80, 0xa3]); // €£ in Win-1252
    const result = decodeTextPart(euroPound, 'windows-1252', '7bit');
    expect(result).toBe('€£');
  });
});
