import type { Contact } from '@/types/contact';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { defineStore } from 'pinia';
import {
  buildTableStorageKey,
  sanitizeVisibleColumns,
  type TableOrigin,
} from '~/utils/table-preferences';
import { convertDates } from '~/utils/contacts';
import {
  applyReconciledContacts,
  collectRealtimePersonIds,
  getContactKey,
  resolveRealtimeAction,
  type RealtimePersonRow,
} from '~/utils/contacts-realtime';
import Normalizer from '~/utils/normalizer';
import { useLeadminerStore } from './leadminer';

const REALTIME_DEBOUNCE_MS = 700;
const REALTIME_RECONCILE_MAX_RETRIES = 3;

export const useContactsStore = defineStore('contacts-store', () => {
  const $user = useSupabaseUser();
  const $supabase = useSupabaseClient();
  const $leadminerStore = useLeadminerStore();

  const updateContactList = ref<boolean>(false);
  const contactsCacheMap = new Map<string, Contact>();
  const contactsList = ref<Contact[] | undefined>();

  const selectedIds = ref<string[] | undefined>();
  const selectedContactsCount = ref<number>(0);
  const visibleColumns = ref(['contacts']);
  const skipOrgLookup = ref(false);

  const tableContext = ref<{ userId: string; origin: TableOrigin } | null>(
    null,
  );

  const contactCount = computed(() => contactsList.value?.length);

  let realtimeChannel: RealtimeChannel | null = null;
  let realtimeChannelUserId: string | null = null;
  let syncIntervalId: ReturnType<typeof setInterval> | null = null;

  let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
  let reconciling = false;
  let reconcileRetryCount = 0;
  const pendingReconcilePersonIds = new Set<string>();

  /**
   * Applies cached contacts to the main contacts list.
   */
  function syncContactsList() {
    if (!contactsCacheMap.size || !updateContactList.value) return;

    let synced: Contact[];
    try {
      synced = convertDates(
        structuredClone([...contactsCacheMap.values()].reverse()),
      );
    } catch {
      console.warn('Failed to clone contacts cache, retrying on next interval');
      return;
    }

    contactsList.value = synced;
    updateContactList.value = false;
    console.debug('Contacts list updated from cache');
  }

  /**
   * Clears the sync interval.
   */
  function clearSyncInterval() {
    if (syncIntervalId) {
      clearInterval(syncIntervalId);
      syncIntervalId = null;
    }
  }

  /**
   * Starts the sync interval to periodically apply cached contacts.
   */
  function startSyncInterval() {
    clearSyncInterval();
    syncIntervalId = setInterval(async () => {
      await syncContactsList();
    }, 2000);
  }

  function getCurrentUserId() {
    return $user.value?.id || ($user.value as { sub?: string } | null)?.sub;
  }

  /**
   * Load contacts from database to store.
   */
  async function loadContacts(userId = getCurrentUserId()) {
    if (!userId) return [];

    const { data, error } = await $supabase
      .schema('private')
      .rpc('get_contacts_table', { p_user_id: userId });

    if (error) throw error;
    return data as unknown as Contact[];
  }

  /**
   * Loads contacts from db and restarts SyncInterval.
   */
  async function reloadContacts() {
    pendingReconcilePersonIds.clear();
    clearReconcileTimer();
    updateContactList.value = false;
    contactsCacheMap.clear();
    const contacts = await loadContacts();
    contacts
      .toReversed()
      .forEach((contact) =>
        contactsCacheMap.set(getContactKey(contact), contact),
      );
    updateContactList.value = true;
    syncContactsList();
  }

  /**
   * Refines contacts in database.
   */
  async function refineContacts() {
    const userId = getCurrentUserId();
    if (!userId) return;

    const { error } = await $supabase
      .schema('private')
      .rpc('refine_persons', { p_user_id: userId });
    if (error) throw error;
  }

  async function updateContactsCache(
    newContact: Contact,
    keepPosition = false,
  ) {
    const clean: Contact = JSON.parse(JSON.stringify(newContact));

    const key = getContactKey(clean);
    const existingContact = contactsCacheMap.get(key);
    const updatedContact = existingContact
      ? { ...existingContact, ...clean }
      : clean;

    if (!skipOrgLookup.value) {
      updatedContact.works_for = await getOrganizationName(
        updatedContact.works_for,
      );
    }
    if (
      updatedContact.location &&
      updatedContact.location_normalized === null
    ) {
      Normalizer.add(updatedContact.location);
    }

    if (keepPosition) {
      contactsCacheMap.set(getContactKey(updatedContact), updatedContact);
    } else {
      // Remove and reinsert to change position in the Map
      contactsCacheMap.delete(key);
      contactsCacheMap.set(key, updatedContact);
    }
  }

  function removeContactsByKeys(keys: string[]) {
    const keySet = new Set(keys);
    if (keySet.size === 0) return;
    for (const key of keySet) {
      contactsCacheMap.delete(key);
    }
    contactsList.value = contactsList.value?.filter(
      (contact) => !keySet.has(getContactKey(contact)),
    );
  }

  function clearReconcileTimer() {
    if (reconcileTimer) {
      clearTimeout(reconcileTimer);
      reconcileTimer = null;
    }
  }

  function scheduleReconcile() {
    clearReconcileTimer();
    reconcileTimer = setTimeout(() => {
      flushRealtimeReconcile();
    }, REALTIME_DEBOUNCE_MS);
  }
  async function flushRealtimeReconcile() {
    if (reconciling) {
      scheduleReconcile();
      return;
    }
    reconciling = true;
    clearReconcileTimer();
    const userId = getCurrentUserId();
    try {
      if (!userId) return;
      if ($leadminerStore.activeMiningTask) return;

      const ids = [...pendingReconcilePersonIds];
      if (ids.length === 0) return;

      const { data, error } = await $supabase
        .schema('private')
        .rpc('get_contacts_view_by_ids', {
          p_user_id: userId,
          p_person_ids: ids,
        });
      if (error) throw error;

      // RPC succeeded — safe to drop the buffered ids.
      pendingReconcilePersonIds.clear();

      const reconciled = data as unknown as Contact[];
      const cached = [...contactsCacheMap.values()];

      const { upserts, prunes } = applyReconciledContacts(
        cached,
        ids,
        reconciled,
      );

      for (const key of prunes) {
        removeContactsByKeys([key]);
      }
      for (const row of upserts) {
        await updateContactsCache(row);
      }
      updateContactList.value = true;
      reconcileRetryCount = 0;
    } catch (e) {
      console.warn('Failed to reconcile contacts from realtime', e);
      // The buffered ids were not cleared (clear happens only after a
      // successful RPC), so a transient failure retries the same groups.
      const retried = reconcileRetryCount + 1;
      if (retried < REALTIME_RECONCILE_MAX_RETRIES) {
        reconcileRetryCount = retried;
        scheduleReconcile();
      }
    } finally {
      reconciling = false;
    }
  }

  function removeOldContacts(ids?: string[]) {
    if (!ids) {
      contactsCacheMap.clear();
      contactsList.value = [];
      return;
    }
    ids.forEach((id) => {
      contactsCacheMap.delete(id);
    });
    contactsList.value = contactsList.value?.filter(
      (contact) => !ids.includes(contact.id),
    );
  }

  /**
   * Subscribes to real-time updates for contacts.
   */
  function subscribeToRealtimeUpdates() {
    const userId = getCurrentUserId();
    if (!userId) return;

    if (realtimeChannel && realtimeChannelUserId !== userId) {
      $supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
      realtimeChannelUserId = null;
    }

    if (realtimeChannel) return;

    realtimeChannel = $supabase.channel(`contacts-table-${userId}`);

    realtimeChannel.on('system', { event: 'reconnected' }, () => {
      console.debug('Realtime reconnected — reloading contacts');
      pendingReconcilePersonIds.clear();
      reloadContacts();
    });

    realtimeChannel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'private',
        table: 'persons',
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<RealtimePersonRow>) => {
        if (!getCurrentUserId()) return;

        const action = resolveRealtimeAction(payload, {
          activeMining: $leadminerStore.activeMiningTask,
        });

        switch (action.kind) {
          case 'stream':
            updateContactsCache(action.row as unknown as Contact);
            updateContactList.value = true;
            return;
          case 'remove':
            removeOldContacts([action.id]);
            updateContactList.value = true;
            return;
          case 'reconcile':
            for (const id of action.personIds) {
              pendingReconcilePersonIds.add(id);
            }
            scheduleReconcile();
            return;
          case 'none':
            return;
          default:
            return;
        }
      },
    );
    realtimeChannelUserId = userId;
    startSyncInterval();
    realtimeChannel.subscribe();
  }

  /**
   * Unsubscribes from real-time updates and clears the sync interval.
   */
  async function unsubscribeFromRealtimeUpdates() {
    pendingReconcilePersonIds.clear();
    clearReconcileTimer();
    await syncContactsList();

    if (realtimeChannel) {
      await realtimeChannel.unsubscribe();
      await $supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
      realtimeChannelUserId = null;
    }
    if (syncIntervalId) clearSyncInterval();
  }

  /**
   * Check if there is data in persons.
   */
  async function hasPersons(userId = getCurrentUserId()): Promise<boolean> {
    if (!userId) return false;

    const { count, error } = await $supabase
      .schema('private')
      .from('persons')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .limit(1);

    if (error) throw error;

    return (count ?? 0) > 0;
  }

  /**
   * Get unique, non-null locations that still need normalization
   */
  function getLocationsToNormalize(): string[] {
    if (!contactsList.value) return [];

    const locations = contactsList.value
      .filter(
        (contact) => contact.location && contact.location_normalized === null,
      )
      .map((contact) => contact.location as string);

    // Remove duplicates
    return [...new Set(locations)];
  }

  function getAutoVisibleColumns(contacts: Contact[]): string[] {
    const columns = new Set<string>(['contacts']);

    for (const contact of contacts) {
      if (contact.name) columns.add('name');
      if (contact.telephone?.length) columns.add('telephone');
      if (contact.location) columns.add('location');
      if (contact.works_for) columns.add('works_for');
      if (contact.job_title) columns.add('job_title');
    }

    return [...columns];
  }

  function ensureNameColumn(columns: string[]): string[] {
    return columns.includes('name') ? columns : [...columns, 'name'];
  }

  function initializeVisibleColumns(
    defaultColumns: string[],
    origin: TableOrigin,
    contacts?: Contact[],
  ) {
    const userId = getCurrentUserId();
    if (!userId || !import.meta.client) {
      visibleColumns.value = ensureNameColumn(
        sanitizeVisibleColumns(defaultColumns),
      );
      return;
    }

    tableContext.value = { userId, origin };
    const key = buildTableStorageKey('columns', userId, origin);
    const storedColumns = localStorage.getItem(key);

    if (!storedColumns) {
      if (contacts && contacts.length > 0) {
        visibleColumns.value = ensureNameColumn(
          sanitizeVisibleColumns(getAutoVisibleColumns(contacts)),
        );
      } else {
        visibleColumns.value = ensureNameColumn(
          sanitizeVisibleColumns(defaultColumns),
        );
      }
      return;
    }

    try {
      visibleColumns.value = ensureNameColumn(
        sanitizeVisibleColumns(JSON.parse(storedColumns)),
      );
    } catch {
      visibleColumns.value = ensureNameColumn(
        sanitizeVisibleColumns(defaultColumns),
      );
    }
  }

  function persistVisibleColumns() {
    if (!import.meta.client || !tableContext.value) {
      return;
    }

    const { userId, origin } = tableContext.value;
    const key = buildTableStorageKey('columns', userId, origin);
    localStorage.setItem(key, JSON.stringify(visibleColumns.value));
  }

  watch(
    visibleColumns,
    () => {
      const sanitized = sanitizeVisibleColumns(visibleColumns.value);
      if (JSON.stringify(sanitized) !== JSON.stringify(visibleColumns.value)) {
        visibleColumns.value = sanitized;
        return;
      }
      persistVisibleColumns();
    },
    { deep: true },
  );

  const combinedLocations = computed(() => {
    return contactsList.value
      ?.filter(
        (contact) =>
          contact.location && contact.location_normalized?.display_name,
      )
      ?.map((contact) => ({
        location: contact.location,
        display_name: contact.location_normalized?.display_name,
      }));
  });

  /**
   * Resets the store.
   */
  function $reset() {
    unsubscribeFromRealtimeUpdates();
    contactsCacheMap.clear();
    updateContactList.value = false;
    contactsList.value = undefined;
    selectedIds.value = undefined;
    selectedContactsCount.value = 0;
    skipOrgLookup.value = false;
  }

  function setSkipOrgLookup(value: boolean) {
    skipOrgLookup.value = value;
  }

  return {
    contactsList,
    selectedIds,
    selectedContactsCount,
    contactCount,
    visibleColumns,
    initializeVisibleColumns,
    combinedLocations,
    $reset,
    loadContacts,
    reloadContacts,
    refineContacts,
    subscribeToRealtimeUpdates,
    unsubscribeFromRealtimeUpdates,
    startSyncInterval,
    clearSyncInterval,
    removeOldContacts,
    hasPersons,
    getLocationsToNormalize,
    updateContactsCache,
    setSkipOrgLookup,
    clearReconcileTimer,
    collectRealtimePersonIds,
  };
});
