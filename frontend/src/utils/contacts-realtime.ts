import type { Contact } from '@/types/contact';

type RealtimeRow = { id?: string; email?: string | null };

/**
 * Stable identity for a merged contact group.
 * The DB exposes contact.contact_id (deterministic uuid per group) — this is
 * the cache key. It does NOT change when person membership or the primary
 * person changes.
 */
export function getContactKey(contact: Pick<Contact, 'contact_id' | 'id'>): string {
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