// eslint-disable-next-line import/prefer-default-export
export function validateType(key: string, value: unknown, type: string) {
  if (value === undefined || value === null) return `${key} is required.`;

  if (type === 'number') {
    if (typeof value !== 'number' || isNaN(value) || value <= 0) {
      return `${key} must be a valid positive number.`;
    }
  }
  if (type === 'boolean') {
    if (typeof value !== 'boolean') {
      return `${key} must be true or false.`;
    }
  }
  if (
    type === 'string[]' &&
    (!Array.isArray(value) ||
      value.some((v) => typeof v !== 'string' || v.trim() === ''))
  ) {
    return `${key} must be an array of non-empty strings.`;
  }
  if (type === 'string') {
    if (typeof value !== 'string' || value.trim() === '') {
      return `${key} must be a non-empty string.`;
    }
  }
  return null;
}
