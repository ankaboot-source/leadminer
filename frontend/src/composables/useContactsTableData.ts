import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useContactsStore } from '~/stores/contacts';
import { useFiltersStore } from '~/stores/filters';
import Normalizer from '~/utils/normalizer';
import { getDefaultVisibleColumns } from '~/utils/table-preferences';

const MINING_ID_PARAM = 'mining_id';

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

      contactsStore.subscribeToRealtimeUpdates('contacts');
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
