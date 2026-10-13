import type { Contact } from '@/types/contact';
import { DEFAULT_FILTERS } from '~/utils/filters-defaults';

/**
 * Whether a contact row carries enrichment output.
 *
 * The enrichment step writes these fields onto `private.persons` during the
 * run, before refinement (`backend/src/db/supabase/enrichments.ts`). `status`
 * is deliberately NOT used here: it is email-verification status and nearly
 * every verified contact has it, so it would match almost everything.
 * `temperature` is not used either: refined rows only exist after
 * `refine_persons` runs at mining completion, so every streamed `/mine` row
 * would have `temperature = null` and the sort would never fire mid-run.
 *
 * On the mine origin `works_for` stays a raw org UUID (org-name resolution is
 * skipped there) — non-null is still a valid signal.
 */
export function isEnrichedContact(
  contact: Pick<Contact, 'job_title' | 'works_for'> | null | undefined,
): boolean {
  if (!contact) return false;
  return Boolean(contact.job_title) || Boolean(contact.works_for);
}

/**
 * Stable partition: enriched rows first, everything else after, with the
 * relative order inside each group preserved (no re-sort — the DB's
 * `temperature DESC NULLS LAST` ordering survives within both groups).
 *
 * Returns a NEW array and never mutates `rows`: callers pass view-layer
 * slices that may alias a props array, so an in-place `sort` here would
 * mutate parent state.
 */
export function partitionEnrichedFirst<
  T extends Pick<Contact, 'job_title' | 'works_for'>,
>(rows: readonly T[]): T[] {
  const enriched: T[] = [];
  const plain: T[] = [];
  for (const row of rows) {
    (isEnrichedContact(row) ? enriched : plain).push(row);
  }
  return [...enriched, ...plain];
}

/** `status.value` written by the "Hide unreachable contacts" toggle. */
const HIDE_UNREACHABLE_STATUSES: ReadonlyArray<string | null> = [
  'VALID',
  'UNKNOWN',
  null,
];

/** `consent_status.value` written by the "Hide unsubscribed contacts" toggle. */
const HIDE_UNSUBSCRIBED_CONSENTS: ReadonlyArray<string | null> = [
  'legitimate_interest',
  'opt_in',
];

function isAllowedStatusValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  if (value.length !== HIDE_UNREACHABLE_STATUSES.length) return false;
  const set = new Set(value);
  return HIDE_UNREACHABLE_STATUSES.every((status) => set.has(status));
}

function isAllowedConsentValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  if (value.length !== HIDE_UNSUBSCRIBED_CONSENTS.length) return false;
  const set = new Set(value);
  return HIDE_UNSUBSCRIBED_CONSENTS.every((consent) => set.has(consent));
}

function readFilterValue(entry: unknown): unknown {
  if (
    entry !== null &&
    typeof entry === 'object' &&
    'value' in (entry as Record<string, unknown>)
  ) {
    return (entry as Record<string, unknown>).value;
  }
  return entry;
}

/**
 * True when the user has no meaningful filters applied — every
 * `DEFAULT_FILTERS` entry is at its default, except the two hide-toggles
 * ("Hide unreachable contacts" → `status`, "Hide unsubscribed contacts" →
 * `consent_status`), which may each sit at either their default or their
 * hide-toggle value.
 *
 * Fail-closed: a missing / nullish snapshot means "unknown", not "no
 * filters", so this returns false. The only caller always holds a real
 * filters object (`MiningTable.vue` reads `$filtersStore.filters` directly),
 * so nullish only ever means something is off — and a sort that silently
 * applies when it should not is worse than one that silently does not.
 *
 * Also fail-closed on filter keys outside `DEFAULT_FILTERS`: a new UI filter
 * key the predicate does not know about may carry a real selection, and the
 * per-key loop below cannot see it — treating it as "no filters" would apply
 * the sort over filtered results.
 */
export function shouldPrioritizeEnrichedContacts(
  filtersValue: Record<string, unknown> | null | undefined,
): boolean {
  if (!filtersValue || typeof filtersValue !== 'object') return false;

  const defaults = DEFAULT_FILTERS as Record<string, unknown>;

  for (const key of Object.keys(filtersValue)) {
    if (!(key in defaults)) return false;
  }

  for (const key of Object.keys(defaults)) {
    if (key === 'status' || key === 'consent_status') continue;
    const current = (filtersValue as Record<string, unknown>)[key];
    if (current === undefined) continue;
    if (JSON.stringify(current) !== JSON.stringify(defaults[key])) {
      return false;
    }
  }

  const statusEntry = (filtersValue as Record<string, unknown>).status;
  if (statusEntry !== undefined) {
    if (
      statusEntry !== null &&
      typeof statusEntry === 'object' &&
      'matchMode' in (statusEntry as Record<string, unknown>) &&
      (statusEntry as Record<string, unknown>).matchMode !==
        (defaults.status as Record<string, unknown>).matchMode
    ) {
      return false;
    }
    if (!isAllowedStatusValue(readFilterValue(statusEntry))) return false;
  }

  const consentEntry = (filtersValue as Record<string, unknown>).consent_status;
  if (consentEntry !== undefined) {
    if (
      consentEntry !== null &&
      typeof consentEntry === 'object' &&
      'matchMode' in (consentEntry as Record<string, unknown>) &&
      (consentEntry as Record<string, unknown>).matchMode !==
        (defaults.consent_status as Record<string, unknown>).matchMode
    ) {
      return false;
    }
    if (!isAllowedConsentValue(readFilterValue(consentEntry))) return false;
  }

  return true;
}
