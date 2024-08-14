import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { Contact } from '@/types/contact';
import { type MiningSourceType } from '~/types/mining';

export const useMiningConsentSidebar = defineStore(
  'mining-consent-sidebar',
  () => {
    const status = ref(false);
    const provider = ref<MiningSourceType>();

    function show(sourceType: MiningSourceType) {
      status.value = true;
      provider.value = sourceType;
    }

    function $reset() {
      status.value = false;
      provider.value = undefined;
    }

    return {
      status,
      provider,
      show,
      $reset,
    };
  },
);

export const useImapDialog = defineStore('imap-dialog', () => {
  const showImapDialog = ref(false);
  function $reset() {
    showImapDialog.value = false;
  }
  return {
    showImapDialog,
    $reset,
  };
});

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
