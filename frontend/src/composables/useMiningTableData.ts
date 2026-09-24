import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useContactsStore } from '~/stores/contacts';
import { useFiltersStore } from '~/stores/filters';
import { useLeadminerStore } from '~/stores/leadminer';
import Normalizer from '~/utils/normalizer';
import { getDefaultVisibleColumns } from '~/utils/table-preferences';

export function useMiningTableData() {
  const contactsStore = useContactsStore();
  const filtersStore = useFiltersStore();
  const leadminerStore = useLeadminerStore();
  let subscribed = false;
  let stopStateWatch: (() => void) | undefined;

  function normalizeStreamedLocations() {
    const locations = contactsStore.getLocationsToNormalize();
    if (locations.length) Normalizer.add(locations);
  }

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
          contactsStore.subscribeToRealtimeUpdates('mine');
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

  return {
    loading: computed(() => false),
    normalizeStreamedLocations,
  };
}
