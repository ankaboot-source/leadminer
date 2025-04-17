export default function validateType(key: string, value: any, type: string) {
  if (value === undefined || value === null) return `${key} is required.`;

  switch (type) {
    case 'number':
      return validateNumber(key, value);
    case 'boolean':
      return validateBoolean(key, value);
    case 'string[]':
      return validateStringArray(key, value);
    default:
      return null;
  }
}

function validateNumber(key: string, value: any) {
  return Number.isNaN(value) || value <= 0
    ? `${key} must be a valid positive number.`
    : null;
}

function validateBoolean(key: string, value: any) {
  return !['true', 'false', true, false].includes(value)
    ? `${key} must be true or false.`
    : null;
}

function validateStringArray(key: string, value: any) {
  return !Array.isArray(value) ||
    value.some((v) => typeof v !== 'string' || v.trim() === '')
    ? `${key} must be an array of non-empty strings.`
    : null;
}
