/**
 * Builds inclusive UID range strings for the window [min, max].
 * @param min - lowest UID (>= 1)
 * @param max - highest UID (>= min)
 * @param chunkSize - max UIDs per range
 * @returns Array of "a:b" UID range strings; empty when min > max.
 */
function buildUidRanges(min: number, max: number, chunkSize = 10000): string[] {
  if (min < 1 || max < min) {
    return [];
  }

  const ranges: string[] = [];
  let start = min;
  while (start <= max) {
    const end = Math.min(start + chunkSize - 1, max);
    ranges.push(`${start}:${end}`);
    start = end + 1;
  }
  return ranges;
}

export default buildUidRanges;
