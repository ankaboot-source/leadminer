import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities, htmlToPlainText } from '@/utils/htmlText';

describe('htmlToPlainText', () => {
  it('decodes &nbsp; into a regular space', () => {
    expect(htmlToPlainText('<p>Les&nbsp;amis</p>')).toBe('Les amis');
  });

  it('decodes common named entities', () => {
    expect(
      htmlToPlainText(
        '<p>Tom &amp; Jerry &lt;3 &gt;. &quot;Hi&quot; &#39;ok&#39;</p>',
      ),
    ).toBe('Tom & Jerry <3 >. "Hi" \'ok\'');
  });

  it('decodes numeric and hex entities', () => {
    expect(htmlToPlainText('<p>caf&#233; &#xe9;t&#233;</p>')).toBe('café été');
  });

  it('converts paragraph boundaries to newlines', () => {
    expect(htmlToPlainText('<p>one</p><p>two</p>')).toBe('one\n\ntwo');
  });

  it('collapses repeated whitespace and trims', () => {
    expect(htmlToPlainText('<p>  a   b </p>')).toBe('a b');
  });

  it('decodes entities only once (double-encoded stays escaped)', () => {
    expect(htmlToPlainText('<p>&amp;nbsp;</p>')).toBe('&nbsp;');
  });

  it('leaves unknown named entities untouched', () => {
    expect(htmlToPlainText('<p>&copy; 2026</p>')).toBe('&copy; 2026');
  });

  it('does not resolve Object.prototype members', () => {
    expect(decodeHtmlEntities('&constructor;')).toBe('&constructor;');
    expect(decodeHtmlEntities('&toString;')).toBe('&toString;');
  });

  it('preserves stray "<" text', () => {
    expect(htmlToPlainText('<p>a < b</p>')).toBe('a < b');
  });

  it('regression: preheader text contains no literal &nbsp;', () => {
    const html =
      '<p>Les&nbsp;amis,&nbsp;la&nbsp;famille,&nbsp;chers&nbsp;amis,</p>' +
      "<p>Face à l'injustice, nous restons unis.</p>";
    const text = htmlToPlainText(html);
    expect(text.includes('&nbsp;')).toBe(false);
    expect(text).toContain('Les amis, la famille, chers amis,');
  });

  it('does not hang on malformed tag soup', () => {
    expect(typeof htmlToPlainText('<a'.repeat(20000))).toBe('string');
  });
});
