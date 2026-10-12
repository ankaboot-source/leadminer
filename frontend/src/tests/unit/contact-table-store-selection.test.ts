import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

const supabaseUser = ref<{ id: string } | null>({ id: 'user-1' });

const channelTopics: string[] = [];

const fakeChannel = {
  on: vi.fn(() => fakeChannel),
  subscribe: vi.fn(() => fakeChannel),
  unsubscribe: vi.fn(() => Promise.resolve()),
};

const supabaseClient = {
  channel: vi.fn((topic: string) => {
    channelTopics.push(topic);
    return fakeChannel;
  }),
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
vi.stubGlobal('getOrganizationName', (org: unknown) => Promise.resolve(org));

vi.mock('~/stores/leadminer', () => ({
  useLeadminerStore: () => ({ activeMiningTask: undefined }),
}));

import { useContactTableStore } from '@/composables/useContactTableStore';
import { useContactsStore } from '@/stores/contacts';
import { useMiningTableStore } from '@/stores/mining-table';

type TableStore = ReturnType<typeof useContactsStore>;

const liveStores: TableStore[] = [];

beforeEach(() => {
  channelTopics.length = 0;
  liveStores.length = 0;
  vi.clearAllMocks();
  setActivePinia(createPinia());
});

afterEach(() => {
  for (const store of liveStores) {
    store.clearReconcileTimer();
    store.clearSyncInterval();
  }
  liveStores.length = 0;
});

describe('useContactTableStore', () => {
  it("resolves 'contacts' to the contacts store", () => {
    expect(useContactTableStore('contacts').$id).toBe('contacts-store');
  });

  it("resolves 'mine' to the mining store", () => {
    expect(useContactTableStore('mine').$id).toBe('mining-table-store');
  });
});

describe('realtime channel topic separation', () => {
  it('requests different topics for the two stores on the same client', () => {
    // Regression: RealtimeClient.channel(topic) returns the EXISTING channel
    // on a topic match instead of creating a second one. A shared topic would
    // hand /mine the contacts store's channel object (already bound to
    // UPDATE+DELETE) and stack its INSERT handler on top — the exact mid-run
    // leak through the topic key.
    const contacts = useContactsStore();
    const mining = useMiningTableStore() as unknown as TableStore;
    liveStores.push(contacts, mining);

    contacts.subscribeToRealtimeUpdates();
    mining.subscribeToRealtimeUpdates();

    expect(supabaseClient.channel).toHaveBeenCalledTimes(2);
    const [contactsTopic, miningTopic] = channelTopics;
    expect(contactsTopic).toContain('contacts');
    expect(miningTopic).toContain('mine');
    expect(contactsTopic).not.toBe(miningTopic);
  });
});
