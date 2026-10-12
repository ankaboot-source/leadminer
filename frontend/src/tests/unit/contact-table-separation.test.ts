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

const supabaseClient = {
  channel: vi.fn(() => fakeChannel),
  removeChannel: vi.fn(() => Promise.resolve()),
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

import { useContactsStore } from '@/stores/contacts';
import { useMiningStore } from '@/stores/mining';
import { REALTIME_EVENT_POLICIES } from '@/utils/contacts-realtime';

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
    const store = useMiningStore() as unknown as TableStore;
    liveStores.push(store);
    store.subscribeToRealtimeUpdates();

    expect(subscribedEvents()).toContain('INSERT');
  });

  it('never produces a stream action for an INSERT payload in contacts', () => {
    // The contacts policy reconciles through get_contacts_view_by_ids; only
    // the mine table streams raw person rows straight into its cache.
    leadminerStore.activeMiningTask = { id: 'mining-1' };
    const store = useContactsStore();
    liveStores.push(store);
    store.subscribeToRealtimeUpdates();

    const action = store.handlePersonRealtimeEvent({
      eventType: 'INSERT',
      new: { id: 'p1', user_id: 'user-1', name: 'Mined mid-run' },
      old: null,
    });

    expect(action.kind).not.toBe('stream');
    expect(action).toEqual({ kind: 'reconcile', personIds: ['p1'] });
  });

  it('streams an INSERT payload straight into the mine table', () => {
    const store = useMiningStore() as unknown as TableStore;
    liveStores.push(store);
    store.subscribeToRealtimeUpdates();

    const action = store.handlePersonRealtimeEvent({
      eventType: 'INSERT',
      new: { id: 'p1', user_id: 'user-1', name: 'Mined mid-run' },
      old: null,
    });

    expect(action.kind).toBe('stream');
  });
});
