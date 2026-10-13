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
  buildPersonChangeFilters,
  getContactKey,
  resolveRealtimeAction,
  type RealtimeAction,
  type RealtimePersonRow,
} from '~/utils/contact-table-realtime';
import Normalizer from '~/utils/normalizer';

const REALTIME_DEBOUNCE_MS = 700;
const REALTIME_RECONCILE_MAX_RETRIES = 3;

/**
 * Shared setup body for the two independent contact tables.
 *
 * `/contacts` (`origin: 'contacts'`) and `/mine` (`origin: 'mine'`) render
 * the same columns through the shared `MiningTable.vue`, so both stores expose
 * the identical public surface built here. The tables stay independent because
 * every piece of realtime policy derives from the captured `origin` — never
 * from global mining state. That global read is what used to leak `/mine`
 * rows into `/contacts` mid-run: one store armed an INSERT listener whenever
 * any mining ran and streamed raw `persons` rows past the refined-contacts
 * gate.
 */
export function createContactTableSetup(origin: TableOrigin) {
  const $user = useSupabaseUser();
  const $supabase = useSupabaseClient();

  const updateContactList = ref<boolean>(false);
  const contactsCacheMap = new Map<string, Contact>();
  const contactsList = ref<Contact[] | undefined>();

  const selectedIds = ref<string[] | undefined>();
  const selectedContactsCount = ref<number>(0);
  const visibleColumns = ref(['contacts']);
  // `works_for` is not a mine-table column (MiningTable.vue excludes it from
  // both the render and the column picker on the mine origin), so resolving
  // org UUIDs there is pure waste on the hot streaming path. The contacts
  // table does render it, so only that origin pays for the lookup.
  const resolvesOrgNames = origin === 'contacts';

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
   *
   * Kept on the public surface as the test-teardown seam (unit tests call
   * it in afterEach); no production call site uses it directly.
   */
  function clearSyncInterval() {
    if (syncIntervalId) {
      clearInterval(syncIntervalId);
      syncIntervalId = null;
    }
  }

  /**
   * Starts the sync interval to periodically apply cached contacts.
   *
   * Kept on the public surface as the test-teardown seam (unit tests call
   * its counterpart in afterEach); no production call site uses it directly.
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
   *
   * --- Concern: data loading (with loadMinedPersons, reloadContacts and
   * refineContacts below). Reads only; subscriptions live under "realtime".
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
   * Seeds the cache with the raw persons mined by a run, keyed exactly like the
   * realtime INSERT stream does.
   *
   * `get_contacts_table` only surfaces refined contacts, and refinement runs
   * once at the end of the pipeline, so a full reload mid-run drops everything
   * mined so far. Reading `persons` by `mining_id` returns the same rows the
   * stream delivers, which lets `/mine` rebuild its list after a navigation or
   * a hard reload without waiting for completion.
   *
   * Only meaningful for the `mine` origin. Kept on the shared surface (rather
   * than hidden from the contacts store) so both stores stay structurally
   * identical; on `contacts` it is a deliberate no-op — throwing here could
   * break a caller that touches both tables in an edge case, while silently
   * backfilling raw persons into `/contacts` would reintroduce the mid-run
   * leak this split exists to prevent.
   */
  async function loadMinedPersons(miningId: string) {
    if (origin !== 'mine') {
      if (import.meta.dev) {
        console.warn(
          `[contact-table:${origin}] loadMinedPersons is a mine-only backfill; ignoring call.`,
        );
      }
      return;
    }
    const userId = getCurrentUserId();
    if (!userId || !miningId) return;

    const { data, error } = await $supabase
      .schema('private')
      .from('persons')
      .select('*')
      .eq('user_id', userId)
      .eq('mining_id', miningId);

    if (error) throw error;

    const rows = (data ?? []) as unknown as RealtimePersonRow[];
    for (const row of rows) {
      await updateContactsCache(row as unknown as Contact);
    }
    if (rows.length) {
      updateContactList.value = true;
      syncContactsList();
    }
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

  /**
   * Merges one contact row into the cache.
   *
   * --- Concern: cache bookkeeping (with syncContactsList above and
   * removeContactsByKeys below; removeOldContacts and
   * getLocationsToNormalize further down belong here too). Owns the
   * cache-map <-> contactsList sync, never the network.
   */
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

    if (resolvesOrgNames) {
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

  /**
   * Clears the pending reconcile timer.
   *
   * --- Concern: realtime (with the sync interval above and schedule /
   * flush / channel handlers below). Every policy here derives from the
   * captured origin, never from global mining state.
   *
   * Kept on the public surface as the test-teardown seam (unit tests call
   * it in afterEach); no production call site uses it directly.
   */
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
   * Handle one person realtime event. The action derives from the table
   * origin captured by the factory: `mine` streams raw rows live, while
   * `contacts` only ever reconciles through `get_contacts_view_by_ids` — it
   * must never stream, or mid-run mining rows would bypass the
   * refined-persons gate and appear on `/contacts`.
   *
   * Internal to the realtime channel binding below: tests observe it through
   * the subscribed channel handlers, never through this return value, so a
   * future change that returns the right value without doing the work cannot
   * pass.
   */
  function handlePersonRealtimeEvent(
    payload: RealtimePostgresChangesPayload<RealtimePersonRow>,
  ): RealtimeAction {
    const userId = getCurrentUserId();
    if (!userId) return { kind: 'none' };

    const action = resolveRealtimeAction(payload, origin);

    switch (action.kind) {
      case 'stream':
        if (action.row.user_id && action.row.user_id !== userId) return action;
        updateContactsCache(action.row as unknown as Contact);
        updateContactList.value = true;
        return action;
      case 'remove':
        removeOldContacts([action.id]);
        updateContactList.value = true;
        return action;
      case 'reconcile':
        for (const id of action.personIds) {
          pendingReconcilePersonIds.add(id);
        }
        scheduleReconcile();
        return action;
      case 'none':
        return action;
      default:
        return action;
    }
  }

  /**
   * Build the table's realtime channel for a user. The topic is origin-scoped
   * (`contacts-table-<origin>-<userId>`) because `RealtimeClient.channel()`
   * returns the EXISTING channel when the topic matches instead of creating a
   * second one: a shared topic would hand `/mine` the contacts store's channel
   * object — already bound to UPDATE+DELETE — and stack its INSERT handler on
   * top, reintroducing the mid-run leak through the topic key. The subscribed
   * events are fixed at subscribe time from the table origin: UPDATE + DELETE
   * for `contacts`, plus INSERT for `mine`.
   */
  function createContactsRealtimeChannel(userId: string) {
    const channel = $supabase.channel(`contacts-table-${origin}-${userId}`);

    for (const filter of buildPersonChangeFilters(origin)) {
      channel.on('postgres_changes', filter, handlePersonRealtimeEvent);
    }

    return channel;
  }

  /**
   * Subscribes to real-time updates for contacts. The user-change teardown
   * runs before the null guard so a logout-without-reload still drops the
   * previous user's channel instead of leaving it subscribed.
   */
  function subscribeToRealtimeUpdates() {
    const userId = getCurrentUserId();

    if (realtimeChannel && realtimeChannelUserId !== userId) {
      $supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
      realtimeChannelUserId = null;
    }

    if (!userId) return;

    if (realtimeChannel) return;

    realtimeChannel = createContactsRealtimeChannel(userId);
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

    const { data, error } = await $supabase
      .schema('private')
      .from('persons')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (error) throw error;

    return (data?.length ?? 0) > 0;
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

  /**
   * --- Concern: column preferences (this function through the
   * visibleColumns watcher and combinedLocations below). Per-origin visible
   * columns persisted to localStorage; no contact data flows here.
   */
  function ensureNameColumn(columns: string[]): string[] {
    return columns.includes('name') ? columns : [...columns, 'name'];
  }

  function initializeVisibleColumns(defaultColumns: string[]) {
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

    let stored: string[] | null = null;
    if (storedColumns) {
      try {
        const parsed = sanitizeVisibleColumns(JSON.parse(storedColumns));
        // An empty stored selection carries no preference (e.g. saved while
        // all columns were deselected): fall through to auto/default columns
        // instead of rendering an empty table.
        if (parsed.length > 0) stored = parsed;
      } catch {
        stored = null;
      }
    }

    // No stored preference: always the declared defaults.
    if (!stored) {
      visibleColumns.value = ensureNameColumn(
        sanitizeVisibleColumns(defaultColumns),
      );
      return;
    }

    visibleColumns.value = ensureNameColumn(stored);
  }

  function persistVisibleColumns() {
    if (!import.meta.client || !tableContext.value) {
      return;
    }

    const { userId, origin: storedOrigin } = tableContext.value;
    const key = buildTableStorageKey('columns', userId, storedOrigin);
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
   * Resets the store: drops its own realtime channel and cache so the other
   * table never inherits this table's subscription or rows on navigation.
   */
  function $reset() {
    unsubscribeFromRealtimeUpdates();
    contactsCacheMap.clear();
    updateContactList.value = false;
    contactsList.value = undefined;
    selectedIds.value = undefined;
    selectedContactsCount.value = 0;
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
    reloadContacts,
    loadMinedPersons,
    refineContacts,
    subscribeToRealtimeUpdates,
    unsubscribeFromRealtimeUpdates,
    startSyncInterval,
    clearSyncInterval,
    removeOldContacts,
    hasPersons,
    getLocationsToNormalize,
    updateContactsCache,
    clearReconcileTimer,
  };
}

/**
 * The `/contacts` table: refined contacts only. Its realtime policy
 * (UPDATE + DELETE → debounced reconcile, never INSERT streaming) comes from
 * the `'contacts'` origin captured below, so an in-flight mining can no
 * longer leak raw `persons` rows into this view.
 *
 * The store ID stays `'contacts-store'` — existing tests and call sites
 * reference it.
 */
export const useContactsStore = defineStore('contacts-store', () =>
  createContactTableSetup('contacts'),
);

/**
 * The `/mine` table: the live view of a running extraction. Its realtime
 * policy (INSERT + UPDATE streaming straight into the cache) comes from the
 * `'mine'` origin captured below. It shares the contact-table setup body with
 * the contacts store so `MiningTable.vue` keeps a single public surface, but
 * the two stores hold fully independent channels and caches.
 */
export const useMiningTableStore = defineStore('mining-table-store', () =>
  createContactTableSetup('mine'),
);

/**
 * Resolves the contact-table store for a table origin.
 *
 * Lives here alongside the stores it resolves: `removeContactsFromDatabase`
 * used to live in `utils/contacts.ts`, which closed an import loop back into
 * the stores — moving it here broke the cycle, so no separate file is needed
 * to dodge a circular import.
 *
 * `/contacts` and `/mine` render through the same `MiningTable.vue` but own
 * independent channels and caches: `contacts` reconciles refined contacts
 * (never streams INSERTs), while `mine` streams the live extraction. Reading
 * the wrong store reintroduces the mid-run leak where `/contacts` displayed
 * `/mine` rows, so every shared call site resolves its store from `origin`
 * instead of importing one store directly.
 */
export function useContactTableStore(origin: TableOrigin) {
  return origin === 'mine' ? useMiningTableStore() : useContactsStore();
}

/**
 * Deletes contacts server-side, then drops them from the owning table's
 * cache. The store must match the caller's `origin`: each table owns an
 * independent cache, so pruning the contacts store for a `/mine` deletion
 * would leave the deleted rows on screen (and vice versa).
 */
export async function removeContactsFromDatabase(
  ids?: string[],
  origin: TableOrigin,
): Promise<void> {
  const $supabaseClient = useSupabaseClient();
  const { error } = await $supabaseClient
    .schema('private')
    .rpc('delete_contacts', {
      p_ids: ids ?? [],
      p_delete_all: ids === undefined,
    });
  if (error) throw error;

  useContactTableStore(origin).removeOldContacts(ids);
}
