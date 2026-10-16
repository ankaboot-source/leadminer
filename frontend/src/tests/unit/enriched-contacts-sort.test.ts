import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

function readFrontendSource(relativePath: string) {
  const absolutePath = path.resolve(__dirname, '../../..', relativePath);
  return fs.readFileSync(absolutePath, 'utf-8');
}

const supabaseUser = ref<{ id: string } | null>({ id: 'user-1' });

type CapturedBinding = {
  filter: { event: string };
  handler: (payload: unknown) => void;
};
const capturedBindings: CapturedBinding[] = [];

const fakeChannel = {
  on: vi.fn(
    (
      _event: string,
      filter: { event: string },
      handler: (payload: unknown) => void,
    ) => {
      capturedBindings.push({ filter, handler });
      return fakeChannel;
    },
  ),
  subscribe: vi.fn(() => fakeChannel),
  unsubscribe: vi.fn(() => Promise.resolve()),
};

const supabaseRpc = vi.fn(() => Promise.resolve({ data: [], error: null }));

const supabaseClient = {
  channel: vi.fn(() => fakeChannel),
  removeChannel: vi.fn(() => Promise.resolve()),
  schema: vi.fn(() => ({ rpc: supabaseRpc })),
};

// The contact-table stores rely on Nuxt auto-imports that resolve to these
// @nuxtjs/supabase runtime composables (the package only exports ".").
vi.mock(
  '/node_modules/@nuxtjs/supabase/dist/runtime/composables/useSupabaseUser.js',
  () => ({
    useSupabaseUser: () => supabaseUser,
  }),
);

vi.mock(
  '/node_modules/@nuxtjs/supabase/dist/runtime/composables/useSupabaseClient.js',
  () => ({
    useSupabaseClient: () => supabaseClient,
  }),
);

vi.stubGlobal('useSupabaseUser', () => supabaseUser);
vi.stubGlobal('useSupabaseClient', () => supabaseClient);
// updateContactsCache resolves org names through this Nuxt auto-import
// (mine origin skips it, but the stub keeps the contacts path safe too).
vi.stubGlobal('getOrganizationName', (org: unknown) => Promise.resolve(org));

import { useMiningTableStore } from '@/stores/contact-table';
import { DEFAULT_FILTERS } from '@/utils/filters-defaults';
import {
  isEnrichedContact,
  partitionEnrichedFirst,
  shouldPrioritizeEnrichedContacts,
} from '@/utils/enriched-contacts';

type TableStore = ReturnType<typeof useMiningTableStore>;

const liveStores: TableStore[] = [];

function makeContact(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    user_id: 'user-1',
    name: `Name ${id}`,
    email: `${id}@example.com`,
    given_name: null,
    family_name: null,
    telephone: null,
    location: null,
    location_normalized: null,
    works_for: null,
    job_title: null,
    same_as: null,
    image: null,
    status: null,
    temperature: null,
    ...overrides,
  };
}

beforeEach(() => {
  capturedBindings.length = 0;
  liveStores.length = 0;
  vi.clearAllMocks();
  supabaseRpc.mockResolvedValue({ data: [], error: null });
  setActivePinia(createPinia());
});

afterEach(() => {
  for (const store of liveStores) {
    store.clearReconcileTimer();
    store.clearSyncInterval();
  }
  liveStores.length = 0;
  vi.useRealTimers();
});

describe('isEnrichedContact', () => {
  it('treats job_title as enriched', () => {
    expect(
      isEnrichedContact(makeContact('a', { job_title: 'CEO' }) as never),
    ).toBe(true);
  });

  it('treats a raw works_for org UUID (mine origin) as enriched', () => {
    expect(
      isEnrichedContact(
        makeContact('a', {
          works_for: '123e4567-e89b-12d3-a456-426614174000',
        }) as never,
      ),
    ).toBe(true);
  });

  it('does not treat verification status alone as enriched', () => {
    expect(
      isEnrichedContact(makeContact('a', { status: 'VALID' }) as never),
    ).toBe(false);
    expect(isEnrichedContact(makeContact('a') as never)).toBe(false);
  });

  it('treats same_as alone as enriched (signature-extraction output)', () => {
    expect(
      isEnrichedContact(
        makeContact('a', {
          same_as: ['https://linkedin.com/in/someone'],
        }) as never,
      ),
    ).toBe(true);
  });

  it('treats the joined-string form of same_as as enriched', () => {
    expect(
      isEnrichedContact(
        makeContact('a', {
          same_as: 'https://linkedin.com/in/a,https://x.com/b',
        }) as never,
      ),
    ).toBe(true);
  });

  it('treats telephone alone as enriched (signature-extraction output)', () => {
    expect(
      isEnrichedContact(
        makeContact('a', { telephone: ['+1-555-0100'] }) as never,
      ),
    ).toBe(true);
  });

  it('treats location alone as enriched', () => {
    expect(
      isEnrichedContact(makeContact('a', { location: 'Berlin, DE' }) as never),
    ).toBe(true);
  });

  it('does not treat empty location as enriched', () => {
    expect(isEnrichedContact(makeContact('a', { location: '' }) as never)).toBe(
      false,
    );
    expect(
      isEnrichedContact(makeContact('a', { location: '  ' }) as never),
    ).toBe(false);
    expect(
      isEnrichedContact(makeContact('a', { location: null }) as never),
    ).toBe(false);
  });

  it('does not treat a contact with all enrichment signals empty as enriched', () => {
    expect(
      isEnrichedContact(
        makeContact('a', {
          job_title: null,
          works_for: null,
          location: '',
          same_as: [],
          telephone: '',
        }) as never,
      ),
    ).toBe(false);
  });

  it('does not treat empty same_as as enriched', () => {
    expect(isEnrichedContact(makeContact('a', { same_as: [] }) as never)).toBe(
      false,
    );
    expect(isEnrichedContact(makeContact('a', { same_as: '' }) as never)).toBe(
      false,
    );
    expect(
      isEnrichedContact(makeContact('a', { same_as: '  ' }) as never),
    ).toBe(false);
  });

  it('does not treat empty telephone as enriched', () => {
    expect(
      isEnrichedContact(makeContact('a', { telephone: [] }) as never),
    ).toBe(false);
    expect(
      isEnrichedContact(makeContact('a', { telephone: '' }) as never),
    ).toBe(false);
  });

  it('does not treat a joined empty telephone string as enriched', () => {
    expect(
      isEnrichedContact(makeContact('a', { telephone: '' }) as never),
    ).toBe(false);
    expect(
      isEnrichedContact(makeContact('a', { telephone: ',' }) as never),
    ).toBe(false);
    expect(
      isEnrichedContact(makeContact('a', { telephone: ' ,  ,' }) as never),
    ).toBe(false);
  });
});

describe('shouldPrioritizeEnrichedContacts', () => {
  it('allows pristine defaults', () => {
    expect(
      shouldPrioritizeEnrichedContacts(
        structuredClone(DEFAULT_FILTERS) as never,
      ),
    ).toBe(true);
  });

  it('allows only the two hide-toggles set', () => {
    const filters = structuredClone(DEFAULT_FILTERS) as Record<string, never>;
    (filters.status as { value: unknown }).value = ['VALID', 'UNKNOWN', null];
    (filters.consent_status as { value: unknown }).value = [
      'legitimate_interest',
      'opt_in',
    ];
    expect(shouldPrioritizeEnrichedContacts(filters as never)).toBe(true);
  });

  it('rejects an unrelated active filter (global search)', () => {
    const filters = structuredClone(DEFAULT_FILTERS) as Record<string, never>;
    (filters.global as { value: unknown }).value = 'typed query';
    expect(shouldPrioritizeEnrichedContacts(filters as never)).toBe(false);
  });

  it('rejects a non-hide status selection', () => {
    const filters = structuredClone(DEFAULT_FILTERS) as Record<string, never>;
    (filters.status as { value: unknown }).value = ['INVALID'];
    expect(shouldPrioritizeEnrichedContacts(filters as never)).toBe(false);
  });

  it('is fail-closed on a missing snapshot (unknown means do not sort)', () => {
    // The view-layer caller always holds a real filters object, so nullish
    // only ever means something is off — and a sort that silently applies
    // when it should not is worse than one that silently does not.
    expect(shouldPrioritizeEnrichedContacts()).toBe(false);
    expect(shouldPrioritizeEnrichedContacts(null as never)).toBe(false);
  });

  it('rejects a filter key outside DEFAULT_FILTERS (unknown means do not sort)', () => {
    // A new UI filter key the predicate does not know about may carry a real
    // selection; the per-key loop cannot see it, so it must block the sort.
    const filters = {
      ...(structuredClone(DEFAULT_FILTERS) as Record<string, unknown>),
      some_future_filter: { value: 'user selection', matchMode: 'CONTAINS' },
    };
    expect(shouldPrioritizeEnrichedContacts(filters as never)).toBe(false);
  });
});

describe('partitionEnrichedFirst', () => {
  it('floats enriched rows above plain ones', () => {
    // DB returns warmth order (plain first); the partition must float up.
    const rows = [
      makeContact('plain-1', { temperature: 10 }),
      makeContact('enriched-1', {
        temperature: 1,
        job_title: 'CTO',
        works_for: 'Acme',
      }),
    ] as never[];
    expect(partitionEnrichedFirst(rows).map((c) => c.id)).toEqual([
      'enriched-1',
      'plain-1',
    ]);
  });

  it('preserves relative order within each group (stable partition)', () => {
    const rows = [
      makeContact('plain-a', { temperature: 30 }),
      makeContact('enriched-b', { temperature: 20, job_title: 'CEO' }),
      makeContact('plain-c', { temperature: 10 }),
      makeContact('enriched-d', { temperature: 1, job_title: 'CFO' }),
    ] as never[];
    // Enriched float up (b before d) and plains keep DB order (a before c):
    // the DB temperature ordering survives inside both groups — no re-sort.
    expect(partitionEnrichedFirst(rows).map((c) => c.id)).toEqual([
      'enriched-b',
      'enriched-d',
      'plain-a',
      'plain-c',
    ]);
  });

  it('does not mutate the input array', () => {
    // The component passes view-layer slices that may alias a props array —
    // an in-place sort here would mutate parent state.
    const rows = [
      makeContact('plain-1', { temperature: 10 }),
      makeContact('enriched-1', { temperature: 1, job_title: 'CTO' }),
    ] as never[];
    const before = rows.map((c) => c.id);
    const partitioned = partitionEnrichedFirst(rows);
    expect(partitioned).not.toBe(rows);
    expect(rows.map((c) => c.id)).toEqual(before);
  });
});

describe('store preserves source order (no store-level sort)', () => {
  // The enriched-first ordering lives in MiningTable.vue's `tableRows`, not
  // in the store: syncContactsList() must hand through the cache order
  // untouched so a broken filter read can never silently reorder rows on the
  // 2s timer. These pin the revert on both paths that feed the list.
  it('keeps DB order on load even when enriched rows are present', async () => {
    supabaseRpc.mockResolvedValue({
      data: [
        makeContact('plain-1', { temperature: 10 }),
        makeContact('enriched-1', {
          temperature: 1,
          job_title: 'CTO',
          works_for: 'Acme',
        }),
      ],
      error: null,
    });
    const store = useMiningTableStore() as unknown as TableStore;
    liveStores.push(store);
    await store.reloadContacts();

    expect(store.contactsList?.map((c) => c.id)).toEqual([
      'plain-1',
      'enriched-1',
    ]);
  });

  it('keeps arrival order for rows arriving through the realtime INSERT stream', async () => {
    vi.useFakeTimers();
    const store = useMiningTableStore() as unknown as TableStore;
    liveStores.push(store);
    store.subscribeToRealtimeUpdates();

    const insertBinding = capturedBindings.find(
      (binding) => binding.filter.event === 'INSERT',
    );
    if (!insertBinding) {
      throw new Error('expected an INSERT binding on the mine channel');
    }
    // Enriched arrives FIRST: syncContactsList() reverses the cache
    // (newest-first), so without a sort plain-1 must lead. A store-level
    // partition would float enriched-1 back to the top instead.
    insertBinding.handler({
      eventType: 'INSERT',
      new: makeContact('enriched-1', {
        temperature: 1,
        job_title: 'CTO',
        works_for: 'Acme',
      }),
      old: null,
    });
    insertBinding.handler({
      eventType: 'INSERT',
      new: makeContact('plain-1', { temperature: 10 }),
      old: null,
    });
    await vi.advanceTimersByTimeAsync(2500);

    expect(store.contactsList?.map((c) => c.id)).toEqual([
      'plain-1',
      'enriched-1',
    ]);
  });
});

describe('mining table applies the enriched-first partition at the view layer', () => {
  // Source-level assertions: mounting MiningTable.vue (PrimeVue DataTable +
  // async children + stores + i18n) is impractical in a unit test, while the
  // failure mode is a silently-dropped computed that compiles fine and leaves
  // the table unsorted. Asserting the wiring directly pins it (same approach
  // as mining-table-origin.test.ts).
  it('gates partitionEnrichedFirst on shouldPrioritizeEnrichedContacts($filtersStore.filters) in tableRows', () => {
    const miningTable = readFrontendSource(
      'src/components/mining/table/MiningTable.vue',
    );

    expect(miningTable).toMatch(
      /const tableRows = computed\(\(\) => \{[\s\S]*?shouldPrioritizeEnrichedContacts\(\$filtersStore\.filters\)[\s\S]*?partitionEnrichedFirst\(rows\)[\s\S]*?\}\);/,
    );
  });

  it('renders the DataTable from tableRows', () => {
    const miningTable = readFrontendSource(
      'src/components/mining/table/MiningTable.vue',
    );

    expect(miningTable).toContain(':value="tableRows"');
  });

  it('keeps the enriched sort out of the contact-table store', () => {
    const contactTableStore = readFrontendSource('src/stores/contact-table.ts');

    expect(contactTableStore).not.toContain('partitionEnrichedFirst');
    expect(contactTableStore).not.toContain('shouldPrioritizeEnrichedContacts');
    expect(contactTableStore).not.toContain('isEnrichedContact');
    expect(contactTableStore).not.toContain('getActivePinia');
  });
});
