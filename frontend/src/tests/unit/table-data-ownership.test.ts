import { defineComponent, nextTick, reactive } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const contactsStore = {
  reloadContacts: vi.fn(),
  hasPersons: vi.fn(async () => false),
  refineContacts: vi.fn(),
  subscribeToRealtimeUpdates: vi.fn(),
  unsubscribeFromRealtimeUpdates: vi.fn(),
  $reset: vi.fn(),
  contactsList: undefined,
  contactCount: 0,
  visibleColumns: [] as string[],
  getLocationsToNormalize: vi.fn(() => [] as string[]),
  initializeVisibleColumns: vi.fn(),
};

const filtersStore = {
  initializeTableFilters: vi.fn(),
  filterByMiningId: vi.fn(),
};

const leadminerStore = reactive({
  activeMiningTask: undefined as Record<string, unknown> | undefined,
  miningCompleted: false,
});

vi.mock('~/stores/contacts', () => ({
  useContactsStore: () => contactsStore,
}));

vi.mock('~/stores/filters', () => ({
  useFiltersStore: () => filtersStore,
}));

vi.mock('~/stores/leadminer', () => ({
  useLeadminerStore: () => leadminerStore,
}));

import { useContactsTableData } from '@/composables/useContactsTableData';
import { useMiningTableData } from '@/composables/useMiningTableData';

const ContactsHarness = defineComponent({
  setup() {
    return useContactsTableData();
  },
  template: '<div />',
});

const MiningHarness = defineComponent({
  setup() {
    return useMiningTableData();
  },
  template: '<div />',
});

describe('useContactsTableData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads once and subscribes the contacts channel', async () => {
    const wrapper = mount(ContactsHarness);
    await flushPromises();

    expect(contactsStore.reloadContacts).toHaveBeenCalledTimes(1);
    expect(filtersStore.initializeTableFilters).toHaveBeenCalledWith(
      'contacts',
    );
    expect(contactsStore.subscribeToRealtimeUpdates).toHaveBeenCalledWith(
      'contacts',
    );
    wrapper.unmount();
    expect(contactsStore.$reset).toHaveBeenCalled();
  });
});

describe('useMiningTableData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadminerStore.activeMiningTask = { id: 'mining-1' };
    leadminerStore.miningCompleted = false;
  });

  it('subscribes mine realtime without any full load', async () => {
    mount(MiningHarness);
    await nextTick();

    expect(contactsStore.subscribeToRealtimeUpdates).toHaveBeenCalledWith(
      'mine',
    );
    expect(contactsStore.reloadContacts).not.toHaveBeenCalled();
    expect(contactsStore.refineContacts).not.toHaveBeenCalled();
    expect(contactsStore.hasPersons).not.toHaveBeenCalled();

    leadminerStore.miningCompleted = true;
    await nextTick();
    expect(
      contactsStore.unsubscribeFromRealtimeUpdates,
    ).toHaveBeenCalled();
  });
});
