/**
 * Validation helpers ported from `backend/src/utils/helpers/validation.ts`.
 *
 * `undefinedIfEmpty` and `undefinedIfFalsy` are used by the enrichment
 * engine parsers to normalize optional fields and array results so that
 * downstream code can rely on `undefined` to mean "no data".
 */

/**
 * Returns the input array with falsy entries filtered out, or `undefined`
 * if no entries remain. Useful for optional list-shaped fields where an
 * empty array should be persisted as `undefined`.
 */
export function undefinedIfEmpty<T>(array: T[]): T[] | undefined {
  const filteredArray = array.filter((val): val is T => Boolean(val));
  return filteredArray.length > 0 ? filteredArray : undefined;
}

/**
 * Returns `value` when truthy, otherwise `undefined`. Used to coerce
 * empty strings, `0`, and `null` into a single "absent" sentinel.
 */
export function undefinedIfFalsy<T>(value: T): T | undefined {
  return value || undefined;
}
