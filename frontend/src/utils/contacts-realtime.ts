import type { Contact } from '@/types/contact';

export type RealtimePersonRow = {
  id?: string;
  email?: string | null;
  name?: string | null;
  source?: string | null;
  telephone?: string[] | null;
  location?: string | null;
  works_for?: string | null;
  job_title?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  image?: string | null;
  alternate_name?: string[] | null;
  same_as?: string[] | null;
  alternate_email?: string[] | null;
  status?: string | null;
  consent_status?: string | null;
  consent_changed_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type RealtimeRow = RealtimePersonRow;

/**
 * Stable identity for a merged contact group.
 * The DB exposes contact.contact_id (deterministic uuid per group) — this is
 * the cache key. It does NOT change when person membership or the primary
 * person changes.
 */
export function getContactKey(
  contact: Pick<Contact, 'contact_id' | 'id'>,
): string {
  return contact.contact_id ?? contact.id;
}

/**
 * Collect the person_id(s) a realtime payload signals changed. These are the
 * keys used to reverse-lookup the affected aggregate group(s) via
 * get_contacts_view_by_ids.
 *
 * - INSERT / UPDATE buffer the NEW row's person id.
 * - UPDATE / DELETE also buffer the OLD row's person id (covers the case where
 *   the id itself changes, and any rename on the person).
 */
export function collectRealtimePersonIds(payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: RealtimeRow | null;
  old?: RealtimeRow | null;
}): string[] {
  const ids = new Set<string>();
  const push = (row?: RealtimeRow | null) => {
    if (row?.id) ids.add(row.id);
  };
  if (payload.eventType !== 'INSERT') push(payload.old);
  if (payload.eventType !== 'DELETE') push(payload.new);
  return [...ids];
}

/**
 * Decide which cache entries to upsert vs prune after re-reading contacts.
 *
 * `reconciled` = the aggregate groups returned by get_contacts_view_by_ids for
 * the buffered `personIds`. Their rows carry person_ids which we use to know a
 * cached contact was touched.
 *
 * - upserts: all reconciled groups (fresh merged state).
 * - prunes: cached contacts whose person_ids overlap the buffered ids but that
 *   were NOT returned — i.e. their last member was removed, or the group
 *   disappeared. Contacts with no overlap are untouched.
 */
export function applyReconciledContacts(
  cached: Contact[],
  bufferedPersonIds: string[],
  reconciled: Contact[],
): { upserts: Contact[]; prunes: string[] } {
  const bufferedSet = new Set(bufferedPersonIds);
  const reconciledKeys = new Set(reconciled.map(getContactKey));
  const prunes = cached
    .filter(
      (c) =>
        (c.person_ids ?? []).some((pid) => bufferedSet.has(pid)) &&
        !reconciledKeys.has(getContactKey(c)),
    )
    .map(getContactKey);
  return { upserts: reconciled, prunes };
}

/**
 * Decide how the contacts store should react to a realtime person event.
 *
 * - During active mining: stream raw person rows (keyed by person id) so newly
 *   mined people appear live. The post-mining reloadContacts() performs a full
 *   contacts_view load that migrates the cache to the merged logic.
 * - Outside mining: buffer person ids for the debounced merged reconcile.
 *
 * Returns a discriminated action the store dispatches.
 */
export type RealtimeAction =
  | { kind: 'stream'; row: RealtimePersonRow }
  | { kind: 'remove'; id: string }
  | { kind: 'reconcile'; personIds: string[] }
  | { kind: 'none' };

export type PersonChangeFilter = {
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  schema: 'private';
  table: 'persons';
  filter: string;
};

/**
 * Filters for the contacts realtime channel. UPDATE + DELETE are always
 * subscribed; INSERT only while a foreground mining is streaming new contacts,
 * so background mining never floods the client (new rows appear on reload).
 */
export function buildPersonChangeFilters(
  userId: string,
  includeInsert: boolean,
): PersonChangeFilter[] {
  const base = {
    schema: 'private' as const,
    table: 'persons' as const,
    filter: `user_id=eq.${userId}`,
  };
  const filters: PersonChangeFilter[] = [
    { ...base, event: 'UPDATE' },
    { ...base, event: 'DELETE' },
  ];
  if (includeInsert) filters.push({ ...base, event: 'INSERT' });
  return filters;
}

export function resolveRealtimeAction(
  payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new?: RealtimePersonRow | null;
    old?: RealtimePersonRow | null;
  },
  opts: { activeMining: boolean },
): RealtimeAction {
  if (opts.activeMining) {
    if (payload.eventType === 'DELETE' && payload.old?.id) {
      return { kind: 'remove', id: payload.old.id };
    }
    if (payload.new?.id) {
      return { kind: 'stream', row: payload.new };
    }
    return { kind: 'none' };
  }

  const personIds = collectRealtimePersonIds(payload);
  if (personIds.length === 0) return { kind: 'none' };
  return { kind: 'reconcile', personIds };
}
