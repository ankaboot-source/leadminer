import { defineComponent, nextTick, reactive } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function makeTableStoreMock() {
  return {
    reloadContacts: vi.fn(),
    loadMinedPersons: vi.fn(() => Promise.resolve()),
    hasPersons: vi.fn().mockResolvedValue(false),
    refineContacts: vi.fn(),
    subscribeToRealtimeUpdates: vi.fn(),
    unsubscribeFromRealtimeUpdates: vi.fn(() => Promise.resolve()),
    $reset: vi.fn(),
    contactsList: undefined,
    contactCount: 0,
    visibleColumns: [] as string[],
    getLocationsToNormalize: vi.fn(() => [] as string[]),
    initializeVisibleColumns: vi.fn(),
  };
}

const contactsStore = makeTableStoreMock();
const miningStore = makeTableStoreMock();

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

vi.mock('~/stores/mining-table', () => ({
  useMiningTableStore: () => miningStore,
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
    // The contacts lifecycle never touches the mining store's channel.
    expect(miningStore.subscribeToRealtimeUpdates).not.toHaveBeenCalled();
    expect(miningStore.reloadContacts).not.toHaveBeenCalled();
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
    miningStore.contactCount = 0;
    contactsStore.contactCount = 0;
  });

  it('subscribes mine realtime without any full load', async () => {
    const wrapper = mount(MiningHarness);
    await flushPromises();

    expect(miningStore.subscribeToRealtimeUpdates).toHaveBeenCalledTimes(1);
    expect(miningStore.reloadContacts).not.toHaveBeenCalled();
    expect(miningStore.refineContacts).not.toHaveBeenCalled();
    expect(miningStore.hasPersons).not.toHaveBeenCalled();
    // The mine lifecycle never drives the contacts store: sharing it would
    // stream raw persons rows into /contacts mid-run.
    expect(contactsStore.subscribeToRealtimeUpdates).not.toHaveBeenCalled();
    expect(contactsStore.reloadContacts).not.toHaveBeenCalled();

    leadminerStore.miningCompleted = true;
    await flushPromises();
    expect(miningStore.unsubscribeFromRealtimeUpdates).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('initializes mine columns on the mining store without loading contacts', async () => {
    const wrapper = mount(MiningHarness);
    await nextTick();

    expect(miningStore.initializeVisibleColumns).toHaveBeenCalledWith(
      getDefaultVisibleColumns('mine'),
    );
    expect(contactsStore.initializeVisibleColumns).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('backfills the run persons when the list is empty on mount', async () => {
    const wrapper = mount(MiningHarness);
    await flushPromises();

    expect(miningStore.loadMinedPersons).toHaveBeenCalledWith('mining-1');
    expect(miningStore.subscribeToRealtimeUpdates).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('skips the backfill when contacts are already loaded', async () => {
    miningStore.contactCount = 42;
    const wrapper = mount(MiningHarness);
    await flushPromises();

    expect(miningStore.loadMinedPersons).not.toHaveBeenCalled();
    expect(miningStore.subscribeToRealtimeUpdates).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('resets the store on unmount and drops the person stream', async () => {
    // The list is rebuilt from the run's persons on the next mount, and
    // /contacts must never inherit the in-flight person stream.
    const wrapper = mount(MiningHarness);
    await flushPromises();

    wrapper.unmount();
    expect(miningStore.$reset).toHaveBeenCalledTimes(1);
    expect(miningStore.unsubscribeFromRealtimeUpdates).toHaveBeenCalled();
    expect(contactsStore.$reset).not.toHaveBeenCalled();
  });

  it('keeps the list on screen until the redirect unmounts the page', async () => {
    const wrapper = mount(MiningHarness);
    await flushPromises();
    expect(miningStore.$reset).not.toHaveBeenCalled();

    leadminerStore.miningCompleted = true;
    leadminerStore.activeMiningTask = undefined;
    await flushPromises();
    expect(miningStore.unsubscribeFromRealtimeUpdates).toHaveBeenCalled();
    expect(miningStore.$reset).not.toHaveBeenCalled();

    wrapper.unmount();
    expect(miningStore.$reset).toHaveBeenCalledTimes(1);
  });

  it('does not wipe a contacts list when mounted with no run', async () => {
    leadminerStore.activeMiningTask = undefined;
    const wrapper = mount(MiningHarness);
    await flushPromises();

    expect(miningStore.$reset).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
