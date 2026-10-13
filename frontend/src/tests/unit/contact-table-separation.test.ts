import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { reactive, ref } from 'vue';

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
// updateContactsCache resolves org names through this Nuxt auto-import.
vi.stubGlobal('getOrganizationName', (org: unknown) => Promise.resolve(org));

// A mining run is in flight globally: the contacts table must ignore that
// fact and keep its UPDATE+DELETE-only subscription.
const leadminerStore = reactive({
  activeMiningTask: { id: 'mining-1' } as Record<string, unknown> | undefined,
});

vi.mock('~/stores/leadminer', () => ({
  useLeadminerStore: () => leadminerStore,
}));

import { useContactsStore, useMiningTableStore } from '@/stores/contact-table';
import { REALTIME_EVENT_POLICIES } from '@/utils/contact-table-realtime';

type TableStore = ReturnType<typeof useContactsStore>;

const liveStores: TableStore[] = [];

function subscribedEvents() {
  return capturedBindings.map((binding) => binding.filter.event);
}

beforeEach(() => {
  capturedBindings.length = 0;
  liveStores.length = 0;
  vi.clearAllMocks();
  leadminerStore.activeMiningTask = { id: 'mining-1' };
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

describe('contact table realtime separation', () => {
  it('never subscribes the contacts policy to INSERT', () => {
    // Direct unit pin on the policy table: the channel-level tests below
    // assert behaviour, but this guards the declaration itself so a future
    // edit cannot quietly re-add INSERT to the contacts origin.
    expect(REALTIME_EVENT_POLICIES.contacts).not.toContain('INSERT');
    expect([...REALTIME_EVENT_POLICIES.contacts].sort()).toEqual([
      'DELETE',
      'UPDATE',
    ]);
  });

  it('subscribes the contacts channel to UPDATE + DELETE only', () => {
    leadminerStore.activeMiningTask = undefined;
    const store = useContactsStore();
    liveStores.push(store);
    store.subscribeToRealtimeUpdates();

    expect(subscribedEvents()).toContain('UPDATE');
    expect(subscribedEvents()).toContain('DELETE');
    expect(subscribedEvents()).not.toContain('INSERT');
  });

  it('keeps the contacts channel INSERT-free while a global mining runs', () => {
    // This is the /contacts-shows-/mine-rows regression: the subscription
    // must derive from the table origin, never from global mining state.
    leadminerStore.activeMiningTask = { id: 'mining-1' };
    const store = useContactsStore();
    liveStores.push(store);
    store.subscribeToRealtimeUpdates();

    expect(subscribedEvents().sort()).toEqual(['DELETE', 'UPDATE']);
  });

  it('subscribes the mine channel with INSERT while a run streams', () => {
    const store = useMiningTableStore() as unknown as TableStore;
    liveStores.push(store);
    store.subscribeToRealtimeUpdates();

    expect(subscribedEvents()).toContain('INSERT');
  });

  it('reconciles a person change on contacts without streaming it', async () => {
    // The contacts policy reconciles through get_contacts_view_by_ids; only
    // the mine table streams raw person rows straight into its cache.
    // Driven through the subscribed UPDATE binding (the handler itself is
    // private): observable state must show the reconcile ran and nothing
    // streamed in.
    vi.useFakeTimers();
    leadminerStore.activeMiningTask = { id: 'mining-1' };
    const store = useContactsStore();
    liveStores.push(store);
    store.subscribeToRealtimeUpdates();

    const updateBinding = capturedBindings.find(
      (binding) => binding.filter.event === 'UPDATE',
    );
    if (!updateBinding) {
      throw new Error('expected an UPDATE binding on the contacts channel');
    }
    updateBinding.handler({
      eventType: 'UPDATE',
      new: { id: 'p1', user_id: 'user-1', name: 'Mined mid-run' },
      old: { id: 'p1', user_id: 'user-1', name: 'Mined mid-run' },
    });
    // Advance past BOTH the 700ms reconcile debounce AND the 2s cache-flush
    // interval: the reconcile only lands in contactsList on flush, so stopping
    // short of the interval would let a handler that streams into the cache
    // pass while looking reconciled. Keep this above the sync interval.
    await vi.advanceTimersByTimeAsync(2500);

    // Nothing streamed into the list ...
    expect(store.contactsList).toBeUndefined();
    // ... and the debounced reconcile actually issued its RPC.
    expect(supabaseRpc).toHaveBeenCalledWith('get_contacts_view_by_ids', {
      p_user_id: 'user-1',
      p_person_ids: ['p1'],
    });
  });

  it('streams an INSERT payload straight into the mine list', async () => {
    // Driven through the subscribed INSERT binding (the handler itself is
    // private): the row must be observable in the list, not just reported
    // by a return value.
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
      new: { id: 'p1', user_id: 'user-1', name: 'Mined mid-run' },
      old: null,
    });
    // The stream lands in the cache first; the sync interval applies it to
    // the list.
    await vi.advanceTimersByTimeAsync(2500);

    expect(store.contactsList).toHaveLength(1);
    expect(store.contactsList?.[0]).toMatchObject({
      id: 'p1',
      name: 'Mined mid-run',
    });
  });
});
