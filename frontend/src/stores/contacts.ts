import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import type { Contact } from '@/types/contact';
import { convertDates, getOrganization } from '~/utils/contacts';

export const useContactsStore = defineStore('contacts-store', () => {
  const $user = useSupabaseUser();
  const $supabase = useSupabaseClient();
  const $leadminerStore = useLeadminerStore();

  const contactsList = ref<Contact[] | undefined>(undefined);
  const cachedContactsList = ref<Contact[]>([]);

  const selectedEmails = ref<string[] | undefined>(undefined);
  const selectedContactsCount = ref<number>(0);

  const contactCount = computed(() => contactsList.value?.length);
  const isMiningTaskActive = computed(() => $leadminerStore.activeTask);

  let realtimeChannel: RealtimeChannel | null = null;
  let syncIntervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Starts the sync interval to periodically apply cached contacts.
   */
  function startSyncInterval() {
    cachedContactsList.value = [];
    syncIntervalId = setInterval(() => {
      applyCachedContacts();
    }, 2000);
  }

  /**
   * Clears the sync interval.
   */
  function clearSyncInterval() {
    if (syncIntervalId) clearInterval(syncIntervalId);
  }

  /**
   * Load contacts from database to store.
   */
  async function loadContacts() {
    const { data, error } = await $supabase.rpc(
      'get_contacts_table',
      // @ts-expect-error: Issue with @nuxt/supabase typing
      { userid: $user.value?.id },
    );

    if (error) throw error;
    contactsList.value = convertDates(data);
  }

  /**
   * Loads contacts from db and restarts SyncInterval.
   */
  async function reloadContacts() {
    clearSyncInterval();
    await loadContacts();
    startSyncInterval();
  }

  /**
   * Refines contacts in database.
   */
  async function refineContacts() {
    const { error } = await $supabase.rpc(
      'refine_persons',
      // @ts-expect-error: Issue with @nuxt/supabase typing
      { userid: $user.value?.id },
    );
    if (error) throw error;
  }

  function upsertTop(newContact: Contact, oldContacts: Contact[]) {
    const index = oldContacts.findIndex(
      (contact) => contact.email === newContact.email,
    );
    const oldContact = oldContacts[index];

    if (index !== -1) {
      oldContacts.splice(index, 1);
    }
    oldContacts.unshift({ ...oldContact, ...newContact });
  }

  /**
   * Handles a new contact from realtime.
   * @param contact - The new contact object.
   */
  async function processNewContact(contact: Contact) {
    if (!contactsList.value) return;

    const [newContact] = convertDates([contact]);
    const { works_for: organizationId } = newContact;

    if (organizationId) {
      const organization = await getOrganization({ id: organizationId }, [
        'name',
      ]);
      newContact.works_for = organization ? organization.name : organizationId;
    }

    // If a mining task is active, cache the contacts for periodic rendering
    if (isMiningTaskActive.value) {
      if (cachedContactsList.value.length === 0) {
        const contactsCopy = JSON.parse(JSON.stringify(contactsList.value));
        cachedContactsList.value = convertDates(contactsCopy);
      }
      upsertTop(newContact, cachedContactsList.value);
    } else {
      // Otherwise, update the contacts instantly
      upsertTop(newContact, contactsList.value);
    }
  }

  /**
   * Applies cached contacts to the main contacts list.
   */
  function applyCachedContacts() {
    if (cachedContactsList.value.length > 0) {
      contactsList.value = cachedContactsList.value;
      cachedContactsList.value = [];
    }
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
          schema: 'public',
          table: 'persons',
          filter: `user_id=eq.${$user.value?.id}`,
        },
        async (payload: RealtimePostgresChangesPayload<Contact>) => {
          const newContact = payload.new as Contact;
          await processNewContact(newContact);
        },
      );

    startSyncInterval();
    realtimeChannel.subscribe();
  }

  /**
   * Unsubscribes from real-time updates and clears the sync interval.
   */
  async function unsubscribeFromRealtimeUpdates() {
    if (realtimeChannel) {
      await realtimeChannel.unsubscribe();
      await $supabase.removeChannel(realtimeChannel);
    }
    if (syncIntervalId) {
      applyCachedContacts();
      clearSyncInterval();
    }
  }

  /**
   * Resets the store.
   */
  function $reset() {
    unsubscribeFromRealtimeUpdates();
    contactsList.value = undefined;
    selectedEmails.value = undefined;
    selectedContactsCount.value = 0;
  }
  cachedContactsList.value = [];

  return {
    contactsList,
    selectedEmails,
    selectedContactsCount,
    contactCount,
    $reset,
    loadContacts,
    reloadContacts,
    refineContacts,
    subscribeToRealtimeUpdates,
    unsubscribeFromRealtimeUpdates,
    startSyncInterval,
    clearSyncInterval,
  };
});
