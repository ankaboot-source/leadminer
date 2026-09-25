import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useContactsStore } from '~/stores/contacts';
import { useFiltersStore } from '~/stores/filters';
import { useLeadminerStore } from '~/stores/leadminer';
import Normalizer from '~/utils/normalizer';
import type { TableOrigin } from '~/utils/table-preferences';

const MINING_ID_PARAM = 'mining_id';

const DEFAULT_VISIBLE_COLUMNS: Record<TableOrigin, string[]> = {
  contacts: ['contacts', 'name', 'location', 'works_for', 'job_title'],
  mine: ['contacts', 'name', 'location', 'job_title'],
};

export function getDefaultVisibleColumns(origin: TableOrigin): string[] {
  return DEFAULT_VISIBLE_COLUMNS[origin];
}

function getMiningIdParam() {
  if (typeof window === 'undefined') return null;
  return new URL(window.location.href).searchParams.get(MINING_ID_PARAM);
}

function removeMiningIdParam() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete(MINING_ID_PARAM);
  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  );
}

/**
 * Owns the /contacts page lifecycle: full table load, refine fallback,
 * normalization, visible columns, mining-id deep link and realtime.
 */
export function useContactsTableData() {
  const contactsStore = useContactsStore();
  const filtersStore = useFiltersStore();
  const loading = ref(true);
  let initialized = false;
  let disposed = false;

  async function initialize() {
    if (initialized) return;
    initialized = true;
    filtersStore.initializeTableFilters('contacts');

    try {
      await contactsStore.reloadContacts();
      if (disposed) return;

      if (!contactsStore.contactCount && (await contactsStore.hasPersons())) {
        await contactsStore.refineContacts();
        if (disposed) return;
        await contactsStore.reloadContacts();
        if (disposed) return;
      }

      const locations = contactsStore.getLocationsToNormalize();
      if (locations.length) Normalizer.add(locations);

      contactsStore.subscribeToRealtimeUpdates();
    } catch (error) {
      console.error('Failed to load contacts table', error);
    } finally {
      if (!disposed) {
        contactsStore.initializeVisibleColumns(
          getDefaultVisibleColumns('contacts'),
          'contacts',
          contactsStore.contactsList,
        );

        const miningId = getMiningIdParam();
        if (miningId) {
          filtersStore.filterByMiningId(miningId);
          if (!contactsStore.visibleColumns.includes(MINING_ID_PARAM)) {
            contactsStore.visibleColumns = [
              ...contactsStore.visibleColumns,
              MINING_ID_PARAM,
            ];
          }
          removeMiningIdParam();
        }

        loading.value = false;
      }
    }
  }

  onMounted(() => void initialize());
  onBeforeUnmount(() => {
    disposed = true;
    contactsStore.$reset();
  });

  return { loading };
}

/**
 * Owns the /mine page lifecycle: subscribes to the realtime stream only while
 * a mining task is active and stops it as soon as mining completes. It never
 * triggers a full contacts load.
 */
export function useMiningTableData() {
  const contactsStore = useContactsStore();
  const filtersStore = useFiltersStore();
  const leadminerStore = useLeadminerStore();
  let subscribed = false;
  let stopStateWatch: (() => void) | undefined;

  onMounted(() => {
    filtersStore.initializeTableFilters('mine');
    contactsStore.initializeVisibleColumns(
      getDefaultVisibleColumns('mine'),
      'mine',
      contactsStore.contactsList,
    );
    stopStateWatch = watch(
      [
        () => Boolean(leadminerStore.activeMiningTask),
        () => leadminerStore.miningCompleted,
      ],
      ([active, completed]) => {
        if (completed || !active) {
          if (!subscribed) return;
          subscribed = false;
          void contactsStore.unsubscribeFromRealtimeUpdates();
          return;
        }

        if (subscribed) return;
        subscribed = true;
        try {
          contactsStore.subscribeToRealtimeUpdates();
        } catch (error) {
          subscribed = false;
          console.error('Failed to subscribe to mining realtime', error);
        }
      },
      { immediate: true },
    );
  });

  onBeforeUnmount(() => {
    stopStateWatch?.();
    contactsStore.$reset();
  });
}
