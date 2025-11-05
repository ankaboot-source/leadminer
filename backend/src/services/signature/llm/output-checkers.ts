import isUrlHttp from 'is-url-http';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { Logger } from 'winston';
import { PersonLD } from '../types';

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s().-]/g, '');
}

export function validatePhones(
  signature: string,
  telephone: string[]
): string[] {
  const cleanSig = normalize(signature);

  return telephone
    .map((rawNumber) => {
      try {
        const parsed = parsePhoneNumberWithError(rawNumber);

        if (!parsed?.isValid()) return null;

        const international = normalize(parsed.formatInternational());
        const national = normalize(parsed.formatNational());
        const e164 = normalize(parsed.number); // +123456789

        const found =
          cleanSig.includes(international) ||
          cleanSig.includes(national) ||
          cleanSig.includes(e164) ||
          cleanSig.includes(normalize(rawNumber));

        return found ? (parsed.number as string) : null;
      } catch (err) {
        return null;
      }
    })
    .filter((p): p is string => Boolean(p));
}

export function validateUrls(signature: string, input: string[]): string[] {
  return input
    .map((url) => (typeof url === 'string' ? url.trim() : ''))
    .filter((url) => isUrlHttp(url));
}

export function parseString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === 'string' && v.trim());
    return first?.trim();
  }

  return undefined;
}

export function parseStringArray(value: unknown): string[] | undefined {
  let raw: string[] = [];

  if (typeof value === 'string') {
    raw = value.split(/[,/]|(?:\s{2,})/); // Allow comma-separated string
  } else if (Array.isArray(value)) {
    raw = value;
  }

  const cleaned = raw
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v);

  return cleaned.length ? [...new Set(cleaned)] : undefined;
}

export function parseLocationString(value: unknown): string | undefined {
  if (!value) return undefined;

  const combined = Array.isArray(value) ? value.join(', ') : String(value);

  return (
    combined
      .replace(/\\n|\n/g, ', ') // replace literal or real newlines with ", "
      .replace(/\s*,\s*/g, ', ') // normalize commas and spaces
      .replace(/\s{2,}/g, ' ') // collapse multiple spaces
      .trim() || undefined
  );
}

export function removeFalsePositives(
  person: PersonLD,
  signature: string,
  logger: Logger
): PersonLD | null {
  const normalizedSignature = normalize(signature);
  const cleaned: Partial<PersonLD> = { ...person };

  for (const [key, value] of Object.entries(cleaned) as [
    keyof PersonLD,
    any
  ][]) {
    // Ignore pre-validated fields
    if (['telephone'].includes(key)) continue;
    if (typeof value === 'string') {
      if (!normalizedSignature.includes(normalize(value))) {
        logger.debug(`Removing hallucinated field: ${key} => ${value}`);
        delete cleaned[key];
      }
    } else if (Array.isArray(value)) {
      const filtered = value.filter((v) => {
        let correct = typeof v !== 'string';
        correct = correct ? normalizedSignature.includes(normalize(v)) : false;
        correct =
          correct ||
          normalizedSignature.includes(normalize(v.split('://').pop()));
        return correct;
      });

      if (filtered.length > 0) {
        (cleaned as any)[key] = filtered;
      } else {
        logger.debug(`Removing hallucinated array field: ${key} => ${value}`);
        delete cleaned[key];
      }
    }
  }

  return Object.keys(cleaned).length ? (cleaned as PersonLD) : null;
}
