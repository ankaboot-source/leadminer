<template>
  <Panel class="mb-4" toggleable :collapsed="collapsePannel">
    <template #header>
      <Button
        severity="secondary"
        unstyled
        @click="collapsePannel = !collapsePannel"
      >
        <span class="font-semibold">
          Mine contacts from your email account
        </span>
      </Button>
    </template>
    <Stepper v-model:active-step="stepper" linear>
      <StepperPanel header="Source">
        <template #content="{ nextCallback }">
          <SourcePanel :next-callback="nextCallback" />
        </template>
      </StepperPanel>

      <StepperPanel header="Mine">
        <template #content="{ prevCallback, nextCallback }">
          <MinePanel
            :mining-source="$leadminerStore.activeMiningSource!"
            :next-callback="nextCallback"
            :prev-callback="prevCallback"
          />
        </template>
      </StepperPanel>
      <StepperPanel header="Clean">
        <template #content="{ prevCallback }">
          <CleanPanel :prev-callback="prevCallback" />
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

const stepper = ref();

const collapsePannel = ref(true);

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
  collapsePannel.value = $leadminerStore.extractedEmails > 0;
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
