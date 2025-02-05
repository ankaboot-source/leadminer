// eslint-disable-next-line import/prefer-default-export
export function validateType(key: string, value: unknown, type: string) {
  if (value === undefined || value === null) return `${key} is required.`;

  if (type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
      return `${key} must be a valid positive number.`;
    }
  }
  if (type === 'boolean') {
    if (
      value !== 'true' &&
      value !== 'false' &&
      value !== true &&
      value !== false
    ) {
      return `${key} must be true or false.`;
    }
  }
  if (type === 'string[]') {
    if (
      !Array.isArray(value) ||
      value.some((v) => typeof v !== 'string' || v.trim() === '')
    ) {
      return `${key} must be an array of non-empty strings.`;
    }
  }
  return null;
}
