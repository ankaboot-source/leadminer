import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

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
import { useFiltersStore } from '@/stores/filters';
import { DEFAULT_FILTERS } from '@/utils/filters-defaults';
import {
  isEnrichedContact,
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
});

describe('enriched-contacts-first ordering', () => {
  it('sorts enriched rows above non-enriched on load', async () => {
    // DB returns warmth order (plain first); enrichment must float to top.
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
      'enriched-1',
      'plain-1',
    ]);
  });

  it('preserves relative order within each group (stable partition)', async () => {
    supabaseRpc.mockResolvedValue({
      data: [
        makeContact('plain-a', { temperature: 30 }),
        makeContact('enriched-b', { temperature: 20, job_title: 'CEO' }),
        makeContact('plain-c', { temperature: 10 }),
        makeContact('enriched-d', { temperature: 1, job_title: 'CFO' }),
      ],
      error: null,
    });
    const store = useMiningTableStore() as unknown as TableStore;
    liveStores.push(store);
    await store.reloadContacts();

    // Enriched float up (b before d) and plains keep DB order (a before c):
    // the DB temperature ordering survives inside both groups — no re-sort.
    expect(store.contactsList?.map((c) => c.id)).toEqual([
      'enriched-b',
      'enriched-d',
      'plain-a',
      'plain-c',
    ]);
  });

  it('does NOT reorder when an unrelated filter is active', async () => {
    const filtersStore = useFiltersStore();
    filtersStore.filters.global.value = 'user is searching';
    supabaseRpc.mockResolvedValue({
      data: [
        makeContact('plain-1', { temperature: 10 }),
        makeContact('enriched-1', { temperature: 1, job_title: 'CTO' }),
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

  it('floats an enriched row arriving through the realtime INSERT stream', async () => {
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
    insertBinding.handler({
      eventType: 'INSERT',
      new: makeContact('plain-1', { temperature: 10 }),
      old: null,
    });
    insertBinding.handler({
      eventType: 'INSERT',
      new: makeContact('enriched-1', {
        temperature: 1,
        job_title: 'CTO',
        works_for: 'Acme',
      }),
      old: null,
    });
    await vi.advanceTimersByTimeAsync(2500);

    expect(store.contactsList?.map((c) => c.id)).toEqual([
      'enriched-1',
      'plain-1',
    ]);
  });
});
