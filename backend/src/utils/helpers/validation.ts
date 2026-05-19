export function undefinedIfEmpty<T>(array: T[]): T[] | undefined {
  const filteredArray = array.filter((val): val is T => Boolean(val));
  return filteredArray.length > 0 ? filteredArray : undefined;
}
export function undefinedIfFalsy<T>(value: T): T | undefined {
  return value || undefined;
}
