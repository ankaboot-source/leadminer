import { ref } from 'vue';
import { defineStore } from 'pinia';
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

    return {
      status,
      provider,
      show,
    };
  }
);
