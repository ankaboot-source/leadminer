import type { Contact } from '@/types/contact';

type ColorSeverity = 'success' | 'warn' | 'danger' | 'secondary' | 'info';

export type PreparedTableRow = Contact & {
  statusLabel: string;
  statusClass: string;
  consentLabel: string;
  consentClass: string;
  visibleTags: string[];
  hiddenTagsCount: number;
  showSocialLinksAndPhones: boolean;
};

type PrepareRowsResolvers = {
  getStatusLabel: (value: Contact['status']) => string;
  getStatusColor: (value: Contact['status']) => ColorSeverity;
  getConsentLabel: (value: Contact['consent_status']) => string;
  getConsentColor: (value: Contact['consent_status']) => ColorSeverity;
};

type ColumnVisibility = Record<string, boolean>;

const COLUMN_KEYS = [
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
];

export function toStateClass(value: ColorSeverity): string {
  switch (value) {
    case 'success':
      return 'state-success';
    case 'warn':
      return 'state-warn';
    case 'danger':
      return 'state-danger';
    case 'info':
      return 'state-info';
    default:
      return 'state-secondary';
  }
}

export function buildColumnVisibility(
  visibleColumns: string[],
): ColumnVisibility {
  const set = new Set(visibleColumns);
  return Object.fromEntries(COLUMN_KEYS.map((key) => [key, set.has(key)]));
}

export function prepareRowsForTable(
  rows: Contact[],
  resolvers: PrepareRowsResolvers,
): PreparedTableRow[] {
  return rows.map((row) => {
    const tags = row.tags ?? [];
    const visibleTags = tags.slice(0, 2);

    return {
      ...row,
      statusLabel: resolvers.getStatusLabel(row.status),
      statusClass: toStateClass(resolvers.getStatusColor(row.status)),
      consentLabel: resolvers.getConsentLabel(row.consent_status),
      consentClass: toStateClass(resolvers.getConsentColor(row.consent_status)),
      visibleTags,
      hiddenTagsCount: Math.max(tags.length - visibleTags.length, 0),
      showSocialLinksAndPhones: Boolean(
        row.same_as?.length || row.telephone?.length,
      ),
    };
  });
}
