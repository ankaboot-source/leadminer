<template>
  <Panel class="mb-4" header="Start a new mining" toggleable>
    <Stepper :active-step="stepper" linear @step-change="handleNavigation">
      <StepperPanel header="Select source">
        <template #content="{ nextCallback }">
          <SourcePanel :next-callback="nextCallback" />
        </template>
      </StepperPanel>

      <StepperPanel header="Mine">
        <template #content="{ prevCallback, nextCallback }">
          <MinePanel
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
    :stepper="stepper"
    :show="showConsentSideBar"
    :source="consentSource"
  />
</template>

<script setup lang="ts">
import type { StepperChangeEvent } from 'primevue/stepper';
import { computed, ref } from 'vue';

import MiningConsentSidebar from '@/components/Mining/MiningConsentSidebar.vue';
import CleanPanel from '@/components/Mining/StepperPanels/CleanPanel.vue';
import MinePanel from '@/components/Mining/StepperPanels/MinePanel.vue';
import SourcePanel from '@/components/Mining/StepperPanels/SourcePanel.vue';
import { type MiningSource, type MiningSourceType } from '~/types/mining';

const $route = useRoute();
const $leadminerStore = useLeadminerStore();

const stepper = ref();

const consentSource = toRef<MiningSource | undefined>(
  $leadminerStore.activeMiningSource
);
const showConsentSideBar = ref(false);

const activeMining = computed(() =>
  Boolean(
    $leadminerStore.miningTask ||
      $leadminerStore.isLoadingBoxes ||
      $leadminerStore.isLoadingStartMining ||
      $leadminerStore.isLoadingStopMining
  )
);

onMounted(() => {
  const { error, provider } = $route.query;
  if (error !== 'oauth-consent') {
    return;
  }

  useRouter().replace({ query: {} });
  consentSource.value = {
    type: provider as MiningSourceType,
    isValid: false,
    email: '',
  };
  showConsentSideBar.value = true;
});

async function getBoxes() {
  try {
    $leadminerStore.isLoadingBoxes = true;
    await $leadminerStore.getBoxes();
    $leadminerStore.isLoadingBoxes = false;
  } catch (err) {
    $leadminerStore.isLoadingBoxes = false;
    showConsentSideBar.value = true;
    console.error(err);
  }
}

async function handleNavigation({ index }: StepperChangeEvent) {
  if (index === 1 && !activeMining.value && !$leadminerStore.boxes.length) {
    await getBoxes();
  }
}
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
