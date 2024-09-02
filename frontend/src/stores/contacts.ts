import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  User,
} from '@supabase/supabase-js';
import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { Contact } from '@/types/contact';
import { getOrganization } from '~/utils/contacts';

export const useContactsStore = defineStore('contacts-store', () => {
  let syncInterval: number;
  let subscription: RealtimeChannel;

  const cachedWaitingToBeSynced = new Set();
  let cachedContacts = new Map<string, Contact>();
  const contacts = ref<Contact[] | undefined>(undefined);
  const contactsLength = computed(() => contacts.value?.length);
  const selected = ref<string[] | undefined>(undefined);
  const selectedLength = ref<number>(0);

  function setContacts(newContacts: Contact[]) {
    contacts.value = newContacts;
    if (contacts.value.length) {
      cachedContacts.clear();
      contacts.value.forEach((contact) => {
        cachedContacts.set(contact.email, contact);
      });
    }
  }

  function refreshContacts() {
    if (cachedWaitingToBeSynced.size > 0) {
      cachedWaitingToBeSynced.clear();
      contacts.value = Array.from(cachedContacts.values());
    }
  }

  function upsertTop(
    email: string,
    contact: Contact,
    map: Map<string, Contact>,
  ) {
    map.delete(email);
    const arr = Array.from(map);
    arr.splice(0, 0, [email, contact]);
    return new Map(arr);
  }

  function subscribeRealtime(user: User) {
    subscription = useSupabaseClient()
      .channel('contacts-table')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'persons',
          filter: `user_id=eq.${user?.id}`,
        },
        async (payload: RealtimePostgresChangesPayload<Contact>) => {
          const newContact = payload.new as Contact;

          if (newContact.works_for) {
            const org = await getOrganization({ id: newContact.works_for }, [
              'name',
            ]);
            newContact.works_for = org ? org.name : newContact.works_for;
          }

          cachedWaitingToBeSynced.add(newContact.email);

          cachedContacts = upsertTop(
            newContact.email,
            {
              ...cachedContacts.get(newContact.email),
              ...newContact,
            },
            cachedContacts,
          );
        },
      );

    syncInterval = window.setInterval(() => {
      refreshContacts();
    }, 2000);

    subscription.subscribe();
  }

  function unsubscribeRealtime() {
    if (subscription) {
      subscription.unsubscribe();
    }
    if (syncInterval) {
      clearInterval(syncInterval);
    }
    cachedWaitingToBeSynced.clear();
    cachedContacts.clear();
  }

  function $reset() {
    contacts.value = undefined;
    selected.value = undefined;
    selectedLength.value = 0;
    unsubscribeRealtime();
  }

  return {
    contacts,
    selected,
    selectedLength,
    contactsLength,
    $reset,
    setContacts,
    refreshContacts,
    subscribeRealtime,
    unsubscribeRealtime,
  };
});
