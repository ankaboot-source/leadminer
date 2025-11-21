import type { Contact } from '@/types/contact';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { convertDates } from '~/utils/contacts';

export const useContactsStore = defineStore('contacts-store', () => {
  const $user = useSupabaseUser();
  const $supabase = useSupabaseClient();

  const updateContactList = ref<boolean>(false);
  const contactsCacheMap = new Map<string, Contact>();
  const contactsList = ref<Contact[] | undefined>(undefined);

  const selectedEmails = ref<string[] | undefined>(undefined);
  const selectedContactsCount = ref<number>(0);

  const contactCount = computed(() => contactsList.value?.length);

  let realtimeChannel: RealtimeChannel | null = null;
  let syncIntervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Applies cached contacts to the main contacts list.
   */
  function syncContactsList() {
    if (!contactsCacheMap.size || !updateContactList.value) return;

    const synced = convertDates(
      structuredClone([...contactsCacheMap.values()].reverse()),
    );

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

  /**
   * Load contacts from database to store.
   */
  async function loadContacts() {
    const { data, error } = await $supabase
      // @ts-expect-error: Issue with nuxt/supabase
      .schema('private')
      .rpc('get_contacts_table', { user_id: $user.value?.sub });

    if (error) throw error;
    return data as Contact[];
  }

  /**
   * Loads contacts from db and restarts SyncInterval.
   */
  async function reloadContacts() {
    updateContactList.value = false;
    contactsCacheMap.clear();
    const contacts = await loadContacts();
    contacts
      .toReversed()
      .forEach((contact) => contactsCacheMap.set(contact.email, contact));
    updateContactList.value = true;
    syncContactsList();
  }

  /**
   * Refines contacts in database.
   */
  async function refineContacts() {
    const { error } = await $supabase
      // @ts-expect-error: Issue with nuxt/supabase
      .schema('private')
      .rpc('refine_persons', { userid: $user.value?.sub });
    if (error) throw error;
  }

  async function updateContactsCache(
    newContact: Contact,
    keepPosition = false,
  ) {
    const { email } = newContact;
    const existingContact = contactsCacheMap.get(email);
    const updatedContact = existingContact
      ? { ...existingContact, ...newContact }
      : newContact;

    newContact.works_for = await getOrganizationName(updatedContact.works_for);

    if (keepPosition) {
      contactsCacheMap.set(updatedContact.email, updatedContact);
    }

    // Remove and reinsert to change position in the Map
    contactsCacheMap.delete(email);
    contactsCacheMap.set(email, updatedContact);
  }

  function removeOldContact(email: string) {
    contactsCacheMap.delete(email);
    contactsList.value = contactsList.value?.filter(
      (contact) => contact.email !== email,
    );
  }

  function removeOldContacts(emails?: string[]) {
    if (!emails) {
      contactsCacheMap.clear();
      contactsList.value = [];
      return;
    }
    emails.forEach((email) => {
      contactsCacheMap.delete(email);
    });
    contactsList.value = contactsList.value?.filter(
      (contact) => !emails.includes(contact.email),
    );
  }

  /**
   * Subscribes to real-time updates for contacts.
   */
  function subscribeToRealtimeUpdates() {
    realtimeChannel = useSupabaseClient()
      .channel('contacts-table')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'private',
          table: 'persons',
          filter: `updated_at=gt.${new Date().toISOString()}`,
        },
        (payload: RealtimePostgresChangesPayload<Contact>) => {
          if (payload.eventType === 'DELETE' && payload.old.email) {
            removeOldContact(payload.old.email);
          } else if (payload.new as Contact) {
            setTimeout(async () => {
              await updateContactsCache(payload.new as Contact);
              updateContactList.value = true;
            }, 0);
          }
        },
      );
    startSyncInterval();
    realtimeChannel.subscribe();
  }

  /**
   * Unsubscribes from real-time updates and clears the sync interval.
   */
  async function unsubscribeFromRealtimeUpdates() {
    await syncContactsList();

    if (realtimeChannel) {
      await realtimeChannel.unsubscribe();
      await $supabase.removeChannel(realtimeChannel);
    }
    if (syncIntervalId) clearSyncInterval();
  }

  /**
   * Check if there is data in persons.
   */
  async function hasPersons(): Promise<boolean> {
    if (!$user.value?.sub) return false;

    const { data, error } = await $supabase
      // @ts-expect-error: Issue with nuxt/supabase
      .schema('private')
      .from('persons')
      .select('*', { count: 'exact' })
      .eq('user_id', $user.value.sub)
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

  const visibleColumns = ref(['contacts']);

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
    selectedEmails.value = undefined;
    selectedContactsCount.value = 0;
  }

  return {
    contactsList,
    selectedEmails,
    selectedContactsCount,
    contactCount,
    visibleColumns,
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
  };
});
