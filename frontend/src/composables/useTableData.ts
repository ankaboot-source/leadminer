import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useContactsStore } from '~/stores/contacts';
import { useFiltersStore } from '~/stores/filters';
import { useLeadminerStore } from '~/stores/leadminer';
import Normalizer from '~/utils/normalizer';
import { shouldPreserveContactsOnUnmount } from '~/utils/mining-table-actions';
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
    // Show the default columns immediately (main parity): until the async
    // full load below resolves, the store would otherwise sit at its
    // checkbox-only init value. Stored/auto columns replace these in `finally`.
    // Spread: DEFAULT_VISIBLE_COLUMNS entries are shared constants.
    contactsStore.visibleColumns = [...getDefaultVisibleColumns('contacts')];
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

  onMounted(initialize);
  onBeforeUnmount(() => {
    disposed = true;
    contactsStore.$reset();
  });

  return { loading };
}

/**
 * Owns the /mine page lifecycle: backfills and subscribes to the realtime
 * stream while a mining task is active, and tears both down as soon as mining
 * completes. It never triggers a full contacts load — `/contacts` owns that.
 */
export function useMiningTableData() {
  const contactsStore = useContactsStore();
  const filtersStore = useFiltersStore();
  const leadminerStore = useLeadminerStore();
  let subscribed = false;
  let stopStateWatch: (() => void) | undefined;

  /**
   * Repopulates the list after a remount (navigation back to /mine, or a hard
   * reload mid-run). The realtime channel only delivers events that happen
   * after it attaches, so everything mined while the table was gone is missing
   * until we re-read the run's persons.
   */
  async function backfillMiningContacts(miningId: string) {
    if (contactsStore.contactCount) return;
    try {
      await contactsStore.loadMinedPersons(miningId);
    } catch (error) {
      console.error('Failed to backfill mining contacts', error);
    }
  }

  onMounted(() => {
    filtersStore.initializeTableFilters('mine');
    contactsStore.initializeVisibleColumns(
      getDefaultVisibleColumns('mine'),
      'mine',
    );
    stopStateWatch = watch(
      [
        () => Boolean(leadminerStore.activeMiningTask),
        () => leadminerStore.miningCompleted,
      ],
      async ([active, completed]) => {
        if (completed || !active) {
          if (!subscribed) return;
          subscribed = false;
          await contactsStore.unsubscribeFromRealtimeUpdates();
          // The run is over: streamed rows are now stale and /contacts does a
          // full reload, so drop them. Guarded on `subscribed` so mounting
          // /mine without a run never wipes a list loaded from /contacts.
          contactsStore.$reset();
          return;
        }

        if (subscribed) return;
        subscribed = true;
        try {
          await backfillMiningContacts(
            leadminerStore.miningTask?.miningId ?? '',
          );
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
    // Mid-run the store holds the only copy of the streamed list, and this
    // composable never does a full load, so resetting here is what leaves
    // /mine empty when the user navigates away and back. Keep the list (and
    // its realtime channel) until the run completes.
    if (
      shouldPreserveContactsOnUnmount(Boolean(leadminerStore.activeMiningTask))
    ) {
      return;
    }
    contactsStore.$reset();
  });
}
