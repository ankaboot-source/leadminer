<template>
  <Panel class="mb-4" header="Start a new mining" toggleable>
    <Stepper linear v-model:active-step="stepper" @step-change="handleNavigation">
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
    v-model:stepper="stepper"
    v-model:show="showOAuthConsentWarning"
    v-model:source="$leadminerStore.activeMiningSource"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

import type { StepperChangeEvent } from 'primevue/stepper';
import MiningConsentSidebar from '@/components/Mining/MiningConsentSidebar.vue';

import SourcePanel from '@/components/Mining/StepperPanels/SourcePanel.vue';
import MinePanel from '@/components/Mining/StepperPanels/MinePanel.vue';
import CleanPanel from '@/components/Mining/StepperPanels/CleanPanel.vue';

const $leadminerStore = useLeadminerStore();

const stepper = ref();
const showOAuthConsentWarning = ref(false);

const activeMining = computed(() =>
  Boolean(
    $leadminerStore.miningTask ||
      $leadminerStore.isLoadingBoxes ||
      $leadminerStore.isLoadingStartMining ||
      $leadminerStore.isLoadingStopMining
  )
);

async function getBoxes() {
  try {
    $leadminerStore.isLoadingBoxes = true;
    await $leadminerStore.getBoxes();
    $leadminerStore.isLoadingBoxes = false;
  } catch (err) {
    $leadminerStore.isLoadingBoxes = false;
    showOAuthConsentWarning.value = true;
  }
}

async function handleNavigation({ index }: StepperChangeEvent) {
  if (index === 1 && !activeMining.value && !$leadminerStore.boxes.length) {
    await getBoxes();
  }
}
</script>
<style>
.q-dialog__inner--minimized > div {
  max-width: 1000px;
}

.bg-banner-color {
  background: linear-gradient(
    135deg,
    rgba(255, 230, 149, 0.5) 0%,
    rgba(255, 248, 225, 0.5) 100%
  );
}
</style>
