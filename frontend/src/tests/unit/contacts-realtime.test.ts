import { describe, expect, it } from 'vitest';
import {
  applyReconciledContacts,
  collectRealtimeKeys,
  getContactKey,
} from '@/utils/contacts-realtime';
import type { Contact } from '@/types/contact';

function contact(partial: Partial<Contact> & { id: string; email?: string | null }): Contact {
  return {
    user_id: 'u1',
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
  it('keys email contacts by their email (lowercased)', () => {
    expect(getContactKey(contact({ id: 'a', email: 'Foo@Bar.com' }))).toBe('foo@bar.com');
  });
  it('keys phone-only contacts by their id', () => {
    expect(getContactKey(contact({ id: 'p1', email: null }))).toBe('p1');
  });
});

describe('collectRealtimeKeys', () => {
  it('INSERT buffers the new row key', () => {
    expect(collectRealtimeKeys({ eventType: 'INSERT', new: { id: 'x', email: 'A@b.c' } })).toEqual(['a@b.c']);
  });
  it('UPDATE buffers both old and new keys (email rename)', () => {
    const keys = collectRealtimeKeys({
      eventType: 'UPDATE',
      old: { id: 'x', email: 'A@b.c' },
      new: { id: 'x', email: 'd@e.f' },
    });
    expect(keys.sort()).toEqual(['a@b.c', 'd@e.f']);
  });
  it('DELETE buffers the old key, falling back to id when email missing', () => {
    expect(
      collectRealtimeKeys({ eventType: 'DELETE', old: { id: 'p1', email: null } }),
    ).toEqual(['p1']);
    expect(
      collectRealtimeKeys({ eventType: 'DELETE', old: { id: 'x', email: 'a@b.c' } }),
    ).toEqual(['a@b.c']);
  });
});

describe('applyReconciledContacts', () => {
  it('returns only upserts for rows that still exist', () => {
    const cached = [contact({ id: 'x', email: 'a@b.c' })];
    const reconciled = [contact({ id: 'y', email: 'a@b.c', name: 'New Primary' })];
    const { upserts, prunes } = applyReconciledContacts(cached, ['a@b.c'], reconciled);
    expect(upserts).toEqual(reconciled);
    expect(prunes).toEqual([]);
  });
  it('prunes buffered keys that no longer exist in the view', () => {
    const cached = [
      contact({ id: 'x', email: 'a@b.c' }),
      contact({ id: 'z', email: 'keep@b.c' }),
    ];
    const { upserts, prunes } = applyReconciledContacts(cached, ['a@b.c', 'keep@b.c'], [
      contact({ id: 'z', email: 'keep@b.c' }),
    ]);
    expect(upserts).toHaveLength(1);
    expect(prunes).toEqual(['a@b.c']);
  });
});