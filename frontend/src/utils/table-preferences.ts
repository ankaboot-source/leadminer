export type TableOrigin = 'contacts' | 'mine';

const STORAGE_PREFIX = 'leadminer:v1:table';
const DATE_FILTER_FIELDS = ['recency', 'seniority', 'updated_at', 'created_at'];

const ALLOWED_COLUMNS = new Set([
  'contacts',
  'source',
  'occurrence',
  'recency',
  'replied_conversations',
  'temperature',
  'tags',
  'status',
  'consent_status',
  'recipient',
  'sender',
  'seniority',
  'given_name',
  'family_name',
  'alternate_name',
  'alternate_email',
  'location',
  'works_for',
  'job_title',
  'name',
  'same_as',
  'telephone',
  'image',
  'updated_at',
  'created_at',
  'mining_id',
]);

type StorageKind = 'filters' | 'columns';

type FilterConstraint = {
  value?: unknown;
};

type FilterValue = {
  constraints?: FilterConstraint[];
};

type ParsedFilters = Record<string, FilterValue>;

export function buildTableStorageKey(
  kind: StorageKind,
  userId: string,
  origin: TableOrigin,
) {
  return `${STORAGE_PREFIX}:${kind}:${userId}:${origin}`;
}

export function sanitizeVisibleColumns(columns: unknown): string[] {
  if (!Array.isArray(columns)) {
    return ['contacts'];
  }

  const sanitized = columns.filter(
    (column): column is string =>
      typeof column === 'string' && ALLOWED_COLUMNS.has(column),
  );

  const unique = [...new Set(sanitized)];
  if (!unique.includes('contacts')) {
    unique.push('contacts');
  }

  return unique;
}

function reviveDateFilters(filters: ParsedFilters) {
  for (const field of DATE_FILTER_FIELDS) {
    const constraints = filters[field]?.constraints;

    if (!Array.isArray(constraints)) {
      continue;
    }

    constraints.forEach((constraint) => {
      if (typeof constraint.value !== 'string') {
        return;
      }

      const parsedDate = new Date(constraint.value);
      if (Number.isNaN(parsedDate.getTime())) {
        return;
      }

      constraint.value = parsedDate;
    });
  }

  return filters;
}

export function parseStoredFilters(raw: string | null): ParsedFilters | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ParsedFilters;
    return reviveDateFilters(parsed);
  } catch {
    return null;
  }
}
