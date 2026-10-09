import { describe, expect, it } from 'vitest';

/**
 * Mirrors the scroll-height arithmetic in MiningTable.vue.
 *
 * The table body must be given an explicit pixel height so PrimeVue scrolls it
 * internally. It previously fell back to 'flex' unless the viewport height
 * changed between setup and mount, which made the whole table grow to the full
 * row height and pushed the scroll onto the page.
 */
const TABLE_CHROME_HEIGHT = 120;
const MIN_TABLE_BODY_HEIGHT = 160;

function resolveScrollHeight({
  viewportHeight,
  tableTop,
  isFullscreen,
}: {
  viewportHeight: number;
  tableTop: number;
  isFullscreen: boolean;
}) {
  if (isFullscreen) return '';
  const available = viewportHeight - tableTop - TABLE_CHROME_HEIGHT;
  return available > MIN_TABLE_BODY_HEIGHT ? `${available}px` : 'flex';
}

describe('resolveScrollHeight', () => {
  it('constrains the table body to a pixel height on a normal visit', () => {
    // Viewport unchanged since setup must still produce a constrained height.
    const result = resolveScrollHeight({
      viewportHeight: 900,
      tableTop: 120,
      isFullscreen: false,
    });

    expect(result).toBe('660px');
  });

  it('constrains the body when the table sits well down the page', () => {
    expect(
      resolveScrollHeight({
        viewportHeight: 1000,
        tableTop: 300,
        isFullscreen: false,
      }),
    ).toBe('580px');
  });

  it('releases the constraint in fullscreen so CSS owns the height', () => {
    expect(
      resolveScrollHeight({
        viewportHeight: 900,
        tableTop: 0,
        isFullscreen: true,
      }),
    ).toBe('');
  });

  it('falls back to flex when there is no room for a usable body', () => {
    // A short viewport must not collapse rows into a 0px scroll area.
    expect(
      resolveScrollHeight({
        viewportHeight: 400,
        tableTop: 300,
        isFullscreen: false,
      }),
    ).toBe('flex');
  });

  it('measures from an unmeasured table top without producing a bogus height', () => {
    // tableTop starts at 0; the header has not settled yet.
    expect(
      resolveScrollHeight({
        viewportHeight: 900,
        tableTop: 0,
        isFullscreen: false,
      }),
    ).toBe('780px');
  });
});
