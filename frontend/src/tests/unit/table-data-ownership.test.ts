import { defineComponent, nextTick, reactive } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const contactsStore = {
  reloadContacts: vi.fn(),
  loadMinedPersons: vi.fn(async () => {}),
  hasPersons: vi.fn().mockResolvedValue(false),
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
  miningTask: undefined as { miningId: string } | undefined,
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

import {
  getDefaultVisibleColumns,
  useContactsTableData,
  useMiningTableData,
} from '@/composables/useTableData';

describe('getDefaultVisibleColumns', () => {
  it('keeps the works-for column in the contacts view', () => {
    expect(getDefaultVisibleColumns('contacts')).toContain('works_for');
  });

  it('does not expose works-for as a mine column', () => {
    expect(getDefaultVisibleColumns('mine')).not.toContain('works_for');
  });
});

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
    expect(contactsStore.subscribeToRealtimeUpdates).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    expect(contactsStore.$reset).toHaveBeenCalled();
  });

  it('applies default columns synchronously at mount, before the load', () => {
    contactsStore.visibleColumns = [];
    mount(ContactsHarness);

    expect(contactsStore.visibleColumns).toEqual(
      getDefaultVisibleColumns('contacts'),
    );
  });
});

describe('useMiningTableData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadminerStore.activeMiningTask = { id: 'mining-1' };
    leadminerStore.miningCompleted = false;
    leadminerStore.miningTask = { miningId: 'mining-1' };
    contactsStore.contactCount = 0;
  });

  it('subscribes mine realtime without any full load', async () => {
    const wrapper = mount(MiningHarness);
    await flushPromises();

    expect(contactsStore.subscribeToRealtimeUpdates).toHaveBeenCalledTimes(1);
    expect(contactsStore.reloadContacts).not.toHaveBeenCalled();
    expect(contactsStore.refineContacts).not.toHaveBeenCalled();
    expect(contactsStore.hasPersons).not.toHaveBeenCalled();

    leadminerStore.miningCompleted = true;
    await flushPromises();
    expect(contactsStore.unsubscribeFromRealtimeUpdates).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('initializes mine columns at mount without loading contacts', async () => {
    const wrapper = mount(MiningHarness);
    await nextTick();

    expect(contactsStore.initializeVisibleColumns).toHaveBeenCalledWith(
      getDefaultVisibleColumns('mine'),
      'mine',
    );

    wrapper.unmount();
  });

  it('backfills the run persons when the list is empty on mount', async () => {
    const wrapper = mount(MiningHarness);
    await flushPromises();

    expect(contactsStore.loadMinedPersons).toHaveBeenCalledWith('mining-1');
    expect(contactsStore.subscribeToRealtimeUpdates).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('skips the backfill when contacts are already loaded', async () => {
    contactsStore.contactCount = 42;
    const wrapper = mount(MiningHarness);
    await flushPromises();

    expect(contactsStore.loadMinedPersons).not.toHaveBeenCalled();
    expect(contactsStore.subscribeToRealtimeUpdates).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('does not reset the store on unmount while mining is active', async () => {
    const wrapper = mount(MiningHarness);
    await nextTick();

    wrapper.unmount();
    expect(contactsStore.$reset).not.toHaveBeenCalled();
  });

  it('resets the store on unmount when no run is active', async () => {
    leadminerStore.activeMiningTask = undefined;
    const wrapper = mount(MiningHarness);
    await nextTick();

    wrapper.unmount();
    expect(contactsStore.$reset).toHaveBeenCalledTimes(1);
  });

  it('drops the streamed list once mining completes', async () => {
    const wrapper = mount(MiningHarness);
    await flushPromises();
    expect(contactsStore.$reset).not.toHaveBeenCalled();

    leadminerStore.miningCompleted = true;
    await flushPromises();
    expect(contactsStore.$reset).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('does not wipe a contacts list when mounted with no run', async () => {
    leadminerStore.activeMiningTask = undefined;
    const wrapper = mount(MiningHarness);
    await flushPromises();

    expect(contactsStore.$reset).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
