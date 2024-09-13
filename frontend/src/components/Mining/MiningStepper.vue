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
    <Stepper v-model:active-step="$stepper.index" linear>
      <StepperPanel header="Source">
        <SourcePanel ref="sourcePanel" />
      </StepperPanel>

      <StepperPanel header="Mine">
        <MinePanel :mining-source="$leadminerStore.activeMiningSource!" />
      </StepperPanel>
      <StepperPanel header="Clean">
        <CleanPanel />
      </StepperPanel>
    </Stepper>
  </Panel>
  <MiningConsentSidebar
    v-model:show="$consentSidebar.status"
    v-model:provider="$consentSidebar.provider"
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
const $stepper = useMiningStepper();
const $consentSidebar = useMiningConsentSidebar();
const $leadminerStore = useLeadminerStore();

const { collapsed } = defineProps<{
  collapsed: boolean;
}>();

const sourcePanel = ref<InstanceType<typeof SourcePanel>>();
const collapsePannel = ref(collapsed);

const { error, provider, source } = $route.query;

onMounted(() => {
  useRouter().replace({ query: {} });

  if (source) {
    sourcePanel.value?.selectSource(source as string);
  } else if (error === 'oauth-consent') {
    $consentSidebar.show(provider as MiningSourceType);
  }
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
