import type { Contact } from '@/types/contact';

type RealtimeRow = { id?: string; email?: string | null };

/**
 * Stable identity for a merged contact group.
 * Email contacts merge under their email; phone-only persons never merge so
 * their person id is the group key.
 */
export function getContactKey(contact: Pick<Contact, 'id' | 'email'>): string {
  return contact.email ? contact.email.toLowerCase() : contact.id;
}

/**
 * Derive the group keys a realtime payload must re-read.
 * Identity transitions (email rename, group member deleted) require both the
 * old and the new key so the pre- and post-change groups are both reconciled.
 */
export function collectRealtimeKeys(payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: RealtimeRow | null;
  old?: RealtimeRow | null;
}): string[] {
  const keys = new Set<string>();
  const push = (row?: RealtimeRow | null) => {
    if (!row || !row.id) return;
    keys.add(row.email ? row.email.toLowerCase() : row.id);
  };
  if (payload.eventType !== 'INSERT') push(payload.old);
  if (payload.eventType !== 'DELETE') push(payload.new);
  return [...keys];
}

/**
 * Apply the freshly read merge rows to the cache decision.
 * Rows returned by get_contacts_table_by_emails are upserts. Any buffered key
 * that no longer exists in the view means its group was deleted (or renamed
 * away) and must be pruned from the cache.
 */
export function applyReconciledContacts(
  cached: Contact[],
  bufferedKeys: string[],
  reconciled: Contact[],
): { upserts: Contact[]; prunes: string[] } {
  const bufferedSet = new Set(bufferedKeys);
  const reconciledKeys = new Set(reconciled.map(getContactKey));
  const prunes = cached
    .filter((c) => bufferedSet.has(getContactKey(c)) && !reconciledKeys.has(getContactKey(c)))
    .map(getContactKey);
  return { upserts: reconciled, prunes };
}