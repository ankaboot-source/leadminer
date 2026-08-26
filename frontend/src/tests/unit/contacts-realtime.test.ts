import { describe, expect, it } from 'vitest';
import {
  applyReconciledContacts,
  collectRealtimePersonIds,
  getContactKey,
} from '@/utils/contacts-realtime';
import type { Contact } from '@/types/contact';

function contact(partial: Partial<Contact> & { id: string; contact_id?: string }): Contact {
  const cid = partial.contact_id ?? `cid-${partial.id}`;
  return {
    user_id: 'u1',
    contact_id: cid,
    name: null,
    given_name: null,
    family_name: null,
    alternate_name: null,
    telephone: null,
    location: null,
    location_normalized: null,
    works_for: null,
    job_title: null,
    same_as: null,
    image: null,
    status: null,
    temperature: null,
    ...partial,
  };
}

describe('getContactKey', () => {
  it('keys a contact by its stable contact_id', () => {
    expect(getContactKey(contact({ id: 'a', contact_id: 'cid-a' }))).toBe('cid-a');
  });
});

describe('collectRealtimePersonIds', () => {
  it('INSERT buffers the new row id', () => {
    expect(collectRealtimePersonIds({ eventType: 'INSERT', new: { id: 'p1' } })).toEqual(['p1']);
  });
  it('UPDATE buffers both old and new ids', () => {
    const ids = collectRealtimePersonIds({
      eventType: 'UPDATE',
      old: { id: 'p-old' },
      new: { id: 'p-new' },
    });
    expect(ids.sort()).toEqual(['p-new', 'p-old']);
  });
  it('UPDATE same id dedupes', () => {
    expect(
      collectRealtimePersonIds({ eventType: 'UPDATE', old: { id: 'p1' }, new: { id: 'p1' } }),
    ).toEqual(['p1']);
  });
  it('DELETE buffers the old id', () => {
    expect(collectRealtimePersonIds({ eventType: 'DELETE', old: { id: 'p1' } })).toEqual(['p1']);
  });
});

describe('applyReconciledContacts', () => {
  it('returns reconciled groups as upserts and no prunes when they still exist', () => {
    const cached = [contact({ id: 'x', contact_id: 'c1', person_ids: ['p1'] })];
    const reconciled = [
      contact({ id: 'y', contact_id: 'c1', person_ids: ['p1', 'p2'], name: 'Merged' }),
    ];
    const { upserts, prunes } = applyReconciledContacts(cached, ['p1'], reconciled);
    expect(upserts).toEqual(reconciled);
    expect(prunes).toEqual([]);
  });
  it('prunes a cached contact whose member person was removed and group vanished', () => {
    const cached = [
      contact({ id: 'x', contact_id: 'c1', person_ids: ['p1'] }),
      contact({ id: 'z', contact_id: 'c2', person_ids: ['p9'] }),
    ];
    const { upserts, prunes } = applyReconciledContacts(cached, ['p1'], []);
    expect(upserts).toEqual([]);
    expect(prunes).toEqual(['c1']);
    expect(prunes).not.toContain('c2');
  });
  it('does not prune a cached contact unaffected by the buffered person ids', () => {
    const cached = [contact({ id: 'z', contact_id: 'c2', person_ids: ['p9'] })];
    const { upserts, prunes } = applyReconciledContacts(cached, ['p1'], []);
    expect(prunes).toEqual([]);
    expect(upserts).toEqual([]);
  });
});