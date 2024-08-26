import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  User,
} from '@supabase/supabase-js';
import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { Contact } from '@/types/contact';

export const useContactsStore = defineStore('contacts-store', () => {
  let syncInterval: number;
  let subscription: RealtimeChannel;
  let cache = new Map<string, Contact>();

  const contacts = ref<Contact[] | undefined>(undefined);
  const selected = ref<String[] | undefined>(undefined);
  const selectedLength = ref<number>(0);
  function setContacts(newContacts: Contact[]) {
    contacts.value = newContacts;
    if (contacts.value.length) {
      cache = new Map(
        contacts.value.map((contact) => [contact.email, contact]),
      );
    }
  }

  function refreshContacts() {
    if (contacts.value?.length !== Array.from(cache.values()).length) {
      contacts.value = Array.from(cache.values());
    }
  }

  function subscribeRealtime(user: User) {
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
        async (payload: RealtimePostgresChangesPayload<Contact>) => {
          const newContact = payload.new as Contact;

          if (newContact.works_for) {
            const { data } = await useSupabaseClient()
              .from('organizations')
              .select('name')
              .eq('id', newContact.works_for)
              .single<{ name: string }>();
            newContact.works_for = data ? data.name : newContact.works_for;
          }

          const cachedContact = cache.get(newContact.email);
          cache.set(newContact.email, { ...cachedContact, ...newContact });
        },
      );

    syncInterval = window.setInterval(() => {
      refreshContacts();
    }, 3000);

    subscription.subscribe();
  }

  function unsubscribeRealtime() {
    if (subscription) {
      subscription.unsubscribe();
    }
    if (syncInterval) {
      clearInterval(syncInterval);
    }
    cache = new Map<string, Contact>();
  }

  function $reset() {
    contacts.value = undefined;
    selected.value = undefined;
    selectedLength.value = 0;
    unsubscribeRealtime();
  }

  return {
    cache,
    contacts,
    selected,
    selectedLength,
    $reset,
    setContacts,
    refreshContacts,
    subscribeRealtime,
    unsubscribeRealtime,
  };
});
