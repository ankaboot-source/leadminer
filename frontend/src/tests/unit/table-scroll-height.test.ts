import { describe, expect, it } from 'vitest';

/**
 * Mirrors the scroll-height arithmetic in MiningTable.vue.
 *
 * The table body must get an explicit pixel height so PrimeVue scrolls it
 * internally. It previously fell back to 'flex' unless the viewport height
 * changed between setup and mount, which let the table grow to the full row
 * height and pushed the scroll onto the page.
 *
 * The space reserved below the body is the measured paginator height, not a
 * constant: the paginator wraps onto extra lines on narrow viewports.
 */
const MIN_TABLE_BODY_HEIGHT = 160;

function resolveScrollHeight({
  viewportHeight,
  tableTop,
  paginatorHeight,
  isFullscreen,
}: {
  viewportHeight: number;
  tableTop: number;
  paginatorHeight: number;
  isFullscreen: boolean;
}) {
  if (isFullscreen) return '';
  const available = viewportHeight - tableTop - paginatorHeight;
  return available > MIN_TABLE_BODY_HEIGHT ? `${available}px` : 'flex';
}

const DESKTOP = {
  viewportHeight: 900,
  tableTop: 120,
  paginatorHeight: 56,
};
const MOBILE = {
  viewportHeight: 700,
  tableTop: 120,
  paginatorHeight: 112,
};

describe('resolveScrollHeight', () => {
  it('constrains the table body on a normal visit', () => {
    // Viewport unchanged since setup must still produce a constrained height.
    expect(resolveScrollHeight({ ...DESKTOP, isFullscreen: false })).toBe(
      '724px',
    );
  });

  it('reserves more room when the paginator wraps on mobile', () => {
    // A taller paginator must shrink the body rather than overflow the page.
    expect(resolveScrollHeight({ ...MOBILE, isFullscreen: false })).toBe(
      '468px',
    );
  });

  it('releases the constraint in fullscreen so CSS owns the height', () => {
    expect(resolveScrollHeight({ ...DESKTOP, isFullscreen: true })).toBe('');
  });

  it('falls back to flex when there is no room for a usable body', () => {
    expect(
      resolveScrollHeight({
        viewportHeight: 400,
        tableTop: 300,
        paginatorHeight: 56,
        isFullscreen: false,
      }),
    ).toBe('flex');
  });

  it('does not double-count chrome before the paginator is measured', () => {
    // Paginator height starts at 0; the body is still constrained, never
    // taller than the viewport allows.
    expect(
      resolveScrollHeight({
        viewportHeight: 900,
        tableTop: 120,
        paginatorHeight: 0,
        isFullscreen: false,
      }),
    ).toBe('780px');
  });

  it('never exceeds the space actually available', () => {
    for (const viewportHeight of [1600, 900, 700, 500, 360]) {
      for (const tableTop of [0, 80, 200]) {
        for (const paginatorHeight of [0, 56, 112, 168]) {
          const result = resolveScrollHeight({
            viewportHeight,
            tableTop,
            paginatorHeight,
            isFullscreen: false,
          });
          if (result === 'flex') continue;
          const body = Number.parseInt(result, 10);
          expect(body).toBeLessThanOrEqual(
            viewportHeight - tableTop - paginatorHeight,
          );
          expect(body).toBeGreaterThan(MIN_TABLE_BODY_HEIGHT);
        }
      }
    }
  });
});
