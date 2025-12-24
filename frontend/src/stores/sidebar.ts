import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { Contact } from '@/types/contact';
import type { MiningSourceType } from '~/types/mining';

export const useImapDialog = defineStore('imap-dialog', () => {
  const $user = useSupabaseUser();
  const imapEmail = ref($user.value?.email ?? '');

  const showImapDialog = ref(false);
  function $reset() {
    showImapDialog.value = false;
    imapEmail.value = '';
  }
  return {
    showImapDialog,
    imapEmail,
    $reset,
  };
});

export const useMiningConsentSidebar = defineStore(
  'mining-consent-sidebar',
  () => {
    const status = ref(false);
    const provider = ref<MiningSourceType>();
    const authorizedRedirect = ref('/mine');

    function show(
      sourceType: MiningSourceType,
      email?: string,
      redirect?: string,
    ) {
      status.value = true;
      provider.value = sourceType;

      if (redirect) {
        authorizedRedirect.value = redirect;
      }

      if (email) {
        useImapDialog().imapEmail = email;
      }
    }

    function $reset() {
      status.value = false;
      provider.value = undefined;
      authorizedRedirect.value = '/mine';
    }

    return {
      status,
      provider,
      authorizedRedirect,
      show,
      $reset,
    };
  },
);

export const useMiningContactInformationSidebar = defineStore(
  'contact-information-sidebar',
  () => {
    const status = ref(false);
    const contact = ref<Contact>();

    function show(data: Contact) {
      status.value = true;
      contact.value = data;
    }

    function $reset() {
      status.value = false;
      contact.value = undefined;
    }

    return {
      status,
      contact,
      show,
      $reset,
    };
  },
);
