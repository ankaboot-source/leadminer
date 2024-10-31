// eslint-disable-next-line import/prefer-default-export
export function validateType(key: string, value: any, type: string) {
  if (value === undefined || value === null) return `${key} is required.`;
  if (type === 'number' && (Number.isNaN(value) || value <= 0)) {
    return `${key} must be a valid positive number.`;
  }
  if (type === 'boolean' && !['true', 'false', true, false].includes(value)) {
    return `${key} must be true or false.`;
  }
  if (
    type === 'string[]' &&
    (!Array.isArray(value) ||
      value.some((v) => typeof v !== 'string' || v.trim() === ''))
  ) {
    return `${key} must be an array of non-empty strings.`;
  }
  return null;
}
