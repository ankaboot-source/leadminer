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

  const contacts = ref<Contact[] | undefined>(undefined);
  const contactsLength = computed(() => contacts.value?.length);
  const selected = ref<string[] | undefined>(undefined);
  const selectedLength = ref<number>(0);

  const $leadminerStore = useLeadminerStore();
  const activeTask = computed(() => $leadminerStore.activeTask);
  const cachedContacts = ref<Contact[]>([]);

  function setContacts(newContacts: Contact[]) {
    contacts.value = newContacts;
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

  async function handleNewContact(newContact: Contact) {
    if (!contacts.value) return;

    if (newContact.works_for) {
      const org = await getOrganization({ id: newContact.works_for }, ['name']);
      newContact.works_for = org ? org.name : newContact.works_for;
    }
    if (activeTask.value) {
      // Cache to render periodically
      if (cachedContacts.value.length === 0)
        cachedContacts.value = JSON.parse(JSON.stringify(contacts.value));
      upsertTop(newContact, cachedContacts.value);
    } else {
      // Render instantly
      upsertTop(newContact, contacts.value);
    }
  }

  function applyCachedContacts() {
    if (cachedContacts.value.length > 0) {
      contacts.value = cachedContacts.value;
      cachedContacts.value = [];
    }
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
          await handleNewContact(newContact);
        },
      );

    syncInterval = window.setInterval(() => {
      applyCachedContacts();
    }, 2000);

    subscription.subscribe();
  }

  function unsubscribeRealtime() {
    if (subscription) {
      subscription.unsubscribe();
    }
    if (syncInterval) {
      applyCachedContacts();
      clearInterval(syncInterval);
    }
  }

  function $reset() {
    contacts.value = undefined;
    selected.value = undefined;
    selectedLength.value = 0;
    cachedContacts.value = [];
    unsubscribeRealtime();
  }

  return {
    contacts,
    selected,
    selectedLength,
    contactsLength,
    $reset,
    setContacts,
    subscribeRealtime,
    unsubscribeRealtime,
  };
});
