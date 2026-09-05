import { describe, expect, it } from 'vitest';
import {
  buildPersonChangeFilters,
  applyReconciledContacts,
  collectRealtimePersonIds,
  getContactKey,
  resolveRealtimeAction,
} from '@/utils/contacts-realtime';
import type { Contact } from '@/types/contact';

function contact(
  partial: Partial<Contact> & { id: string; contact_id?: string },
): Contact {
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
    expect(getContactKey(contact({ id: 'a', contact_id: 'cid-a' }))).toBe(
      'cid-a',
    );
  });
});

describe('collectRealtimePersonIds', () => {
  it('INSERT buffers the new row id', () => {
    expect(
      collectRealtimePersonIds({ eventType: 'INSERT', new: { id: 'p1' } }),
    ).toEqual(['p1']);
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
      collectRealtimePersonIds({
        eventType: 'UPDATE',
        old: { id: 'p1' },
        new: { id: 'p1' },
      }),
    ).toEqual(['p1']);
  });
  it('DELETE buffers the old id', () => {
    expect(
      collectRealtimePersonIds({ eventType: 'DELETE', old: { id: 'p1' } }),
    ).toEqual(['p1']);
  });
});

describe('applyReconciledContacts', () => {
  it('returns reconciled groups as upserts and no prunes when they still exist', () => {
    const cached = [contact({ id: 'x', contact_id: 'c1', person_ids: ['p1'] })];
    const reconciled = [
      contact({
        id: 'y',
        contact_id: 'c1',
        person_ids: ['p1', 'p2'],
        name: 'Merged',
      }),
    ];
    const { upserts, prunes } = applyReconciledContacts(
      cached,
      ['p1'],
      reconciled,
    );
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

describe('resolveRealtimeAction', () => {
  it('streams a raw INSERT row while mining is active', () => {
    const action = resolveRealtimeAction(
      {
        eventType: 'INSERT',
        new: { id: 'p1', name: 'Mined', email: 'm@x.com' },
      },
      { activeMining: true },
    );
    expect(action.kind).toBe('stream');
    if (action.kind === 'stream') {
      expect(action.row.id).toBe('p1');
    }
  });

  it('streams a raw UPDATE row while mining is active', () => {
    const action = resolveRealtimeAction(
      {
        eventType: 'UPDATE',
        old: { id: 'p1' },
        new: { id: 'p1', name: 'NewName' },
      },
      { activeMining: true },
    );
    expect(action.kind).toBe('stream');
  });

  it('removes by person id on DELETE while mining is active', () => {
    const action = resolveRealtimeAction(
      { eventType: 'DELETE', old: { id: 'p1' } },
      { activeMining: true },
    );
    expect(action).toEqual({ kind: 'remove', id: 'p1' });
  });

  it('returns none for a mining DELETE without an old id', () => {
    const action = resolveRealtimeAction(
      { eventType: 'DELETE', old: null },
      { activeMining: true },
    );
    expect(action.kind).toBe('none');
  });

  it('buffers person ids for merged reconcile outside mining', () => {
    const action = resolveRealtimeAction(
      { eventType: 'INSERT', new: { id: 'p1' } },
      { activeMining: false },
    );
    expect(action).toEqual({ kind: 'reconcile', personIds: ['p1'] });
  });

  it('reconciles old+new ids on UPDATE outside mining', () => {
    const action = resolveRealtimeAction(
      { eventType: 'UPDATE', old: { id: 'old' }, new: { id: 'new' } },
      { activeMining: false },
    );
    expect(action).toEqual({ kind: 'reconcile', personIds: ['old', 'new'] });
  });

  it('reconciles the old id on DELETE outside mining', () => {
    const action = resolveRealtimeAction(
      { eventType: 'DELETE', old: { id: 'p1' } },
      { activeMining: false },
    );
    expect(action).toEqual({ kind: 'reconcile', personIds: ['p1'] });
  });
});

describe('buildPersonChangeFilters', () => {
  it('always includes UPDATE + DELETE and excludes INSERT when not mining', () => {
    const filters = buildPersonChangeFilters('u1', false);
    expect(filters).toHaveLength(2);
    expect(filters.map((f) => f.event).sort()).toEqual(['DELETE', 'UPDATE']);
    expect(filters.every((f) => f.filter === 'user_id=eq.u1')).toBe(true);
  });

  it('adds the INSERT filter while a foreground mining is active', () => {
    const filters = buildPersonChangeFilters('u1', true);
    expect(filters.map((f) => f.event).sort()).toEqual([
      'DELETE',
      'INSERT',
      'UPDATE',
    ]);
  });
});
