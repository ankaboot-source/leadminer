import { defineStore } from 'pinia';
import { ref } from 'vue';

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  User,
} from '@supabase/supabase-js';
import type { Contact } from '@/types/contact';

export const useContactsStore = defineStore('contacts-store', () => {
  let syncInterval: number;
  let subscription: RealtimeChannel;
  let cache = new Map<string, Contact>();
  const contacts = ref<Contact[]>([]);

  function setContacts(newContacts: Contact[]) {
    contacts.value = newContacts;
    if (contacts.value.length) {
      cache = new Map(
        contacts.value.map((contact) => [contact.email, contact])
      );
    }
  }

  function refreshContacts() {
    contacts.value = Array.from(cache.values());
  }

  async function subscribeRealtime(user: User) {
    subscription = useSupabaseClient()
      .channel('*')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'persons',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Contact>) => {
          const newContact = payload.new as Contact;
          cache.set(newContact.email, newContact);
        }
      );

    syncInterval = window.setInterval(() => {
      refreshContacts();
    }, 5000);

    subscription.subscribe();
  }

  function unsubscribeRealtime() {
    if (subscription) {
      subscription.unsubscribe();
    }

    if (syncInterval) {
      clearInterval(syncInterval);
    }
  }

  return {
    cache,
    contacts,
    setContacts,
    refreshContacts,
    subscribeRealtime,
    unsubscribeRealtime,
  };
});
