<template>
  <Panel class="mb-4" :header="panelHeader" toggleable>
    <Stepper v-model:active-step="stepper" linear>
      <StepperPanel header="Source">
        <template #content="{ nextCallback }">
          <SourcePanel
            v-model:title="panelHeader"
            :next-callback="nextCallback"
          />
        </template>
      </StepperPanel>

      <StepperPanel header="Mine">
        <template #content="{ prevCallback, nextCallback }">
          <MinePanel
            v-model:title="panelHeader"
            :mining-source="$leadminerStore.activeMiningSource!"
            :next-callback="nextCallback"
            :prev-callback="prevCallback"
          />
        </template>
      </StepperPanel>
      <StepperPanel header="Clean">
        <template #content="{ prevCallback }">
          <CleanPanel
            v-model:title="panelHeader"
            :prev-callback="prevCallback"
          />
        </template>
      </StepperPanel>
    </Stepper>
  </Panel>
  <MiningConsentSidebar
    v-model:show="$consentSidebar.status"
    v-model:provider="$consentSidebar.provider"
    v-model:stepper="stepper"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';

import MiningConsentSidebar from '@/components/Mining/MiningConsentSidebar.vue';
import CleanPanel from '@/components/Mining/StepperPanels/CleanPanel.vue';
import MinePanel from '@/components/Mining/StepperPanels/MinePanel.vue';
import SourcePanel from '@/components/Mining/StepperPanels/SourcePanel.vue';
import type { MiningSourceType } from '~/types/mining';

const $route = useRoute();
const $consentSidebar = useMiningConsentSidebar();
const $leadminerStore = useLeadminerStore();

const panelHeader = ref('');
const stepper = ref();

const { error, provider, source } = $route.query;

if (source) {
  await $leadminerStore.fetchMiningSources();
  $leadminerStore.activeMiningSource = $leadminerStore.getMiningSourceByEmail(
    source as string
  );
  if ($leadminerStore.activeMiningSource) {
    stepper.value = 1;
  }
} else if (error === 'oauth-consent') {
  $consentSidebar.show(provider as MiningSourceType);
}

onMounted(() => {
  useRouter().replace({ query: {} });
});
</script>
<style>
.bg-banner-color {
  background: linear-gradient(
    135deg,
    rgba(255, 230, 149, 0.5) 0%,
    rgba(255, 248, 225, 0.5) 100%
  );
}
</style>
