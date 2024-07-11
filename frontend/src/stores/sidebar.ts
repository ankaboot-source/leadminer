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
  }
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

    function getSameAsIcon(url: string) {
      const match = url.match(
        /\.?(twitter|linkedin|facebook|instagram|x)\./
      )?.[1];

      if (match === 'x') {
        return 'twitter';
      }

      return match ?? 'globe';
    }

    return {
      status,
      contact,
      show,
      $reset,
      getSameAsIcon,
    };
  }
);
