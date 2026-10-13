import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useContactsStore, useMiningTableStore } from '~/stores/contact-table';
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
  const leadminerStore = useLeadminerStore();
  const loading = ref(true);
  let initialized = false;
  let disposed = false;
  let completionReloaded = false;

  // A same-route navigateTo('/contacts') on completion does not remount the
  // page, so reload here when the run finishes while /contacts is open.
  // Idempotent: fires at most once per mount; a remount re-runs initialize()
  // instead, so a second reload would only double-fetch.
  const stopCompletionWatch = watch(
    () => leadminerStore.miningCompleted,
    async (completed) => {
      if (!completed || disposed || completionReloaded) return;
      completionReloaded = true;
      try {
        await contactsStore.reloadContacts();
      } catch (error) {
        console.error('Failed to reload contacts after mining', error);
      }
    },
  );

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

      // Refine fallback for stale empty tables (persons but no refined
      // contacts). Skipped while a run is active: the backend refines once at
      // pipeline completion, and refining a partial dataset here would produce
      // false/partial results. /contacts reloads via the completion watcher
      // below instead.
      if (
        !contactsStore.contactCount &&
        !leadminerStore.activeMiningTask &&
        (await contactsStore.hasPersons())
      ) {
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
    stopCompletionWatch();
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
  const miningStore = useMiningTableStore();
  const filtersStore = useFiltersStore();
  const leadminerStore = useLeadminerStore();
  const loading = ref(false);
  let subscribed = false;
  let stopStateWatch: (() => void) | undefined;

  /**
   * Rebuilds the list on mount from the run's own persons. The realtime stream
   * only carries events that happen after it attaches, so a navigation back to
   * /mine would otherwise show an empty table until the next row arrives.
   */
  async function backfillMiningContacts(miningId: string) {
    if (miningStore.contactCount) return;
    loading.value = true;
    try {
      await miningStore.loadMinedPersons(miningId);
    } catch (error) {
      console.error('Failed to backfill mining contacts', error);
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    filtersStore.initializeTableFilters('mine');
    miningStore.initializeVisibleColumns(getDefaultVisibleColumns('mine'));
    stopStateWatch = watch(
      [
        () => Boolean(leadminerStore.activeMiningTask),
        () => leadminerStore.miningCompleted,
      ],
      async ([active, completed]) => {
        if (completed || !active) {
          if (!subscribed) return;
          subscribed = false;
          await miningStore.unsubscribeFromRealtimeUpdates();
          // No $reset(): the list stays on screen until the redirect to
          // /contacts unmounts this page, so it does not blank out in between.
          return;
        }

        if (subscribed) return;
        subscribed = true;
        try {
          await backfillMiningContacts(
            leadminerStore.miningTask?.miningId ?? '',
          );
          miningStore.subscribeToRealtimeUpdates();
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
    // /contacts owns its own subscription and reloads from
    // get_contacts_table, so drop ours here: leaving the person stream
    // attached would push in-flight rows into /contacts.
    miningStore.unsubscribeFromRealtimeUpdates().catch((error) => {
      console.error('Failed to unsubscribe from mining realtime', error);
    });
    // This page's list is rebuilt from the run's persons on mount, so there is
    // no reason to hold it in memory while unmounted.
    miningStore.$reset();
  });

  return { loading };
}
