<template>
  <Stepper v-model:value="$stepper.index" linear class="flex flex-col grow">
    <StepList>
      <Step v-slot="{ active, value }" as-child :value="1">
        <StepWithPopover
          :step-number="Number(value)"
          :is-active="active"
          :title="t('source')"
        />
      </Step>
      <Step v-slot="{ active, value }" as-child :value="2">
        <StepWithPopover
          :step-number="Number(value)"
          :is-active="active"
          :title="$t('common.mine')"
        />
      </Step>
      <Step v-slot="{ active, value }" as-child :value="3">
        <StepWithPopover
          :step-number="Number(value)"
          :is-active="active"
          :title="$t('common.clean')"
        />
      </Step>
    </StepList>

    <StepPanels class="flex flex-col grow">
      <StepPanel v-slot="{ active }" :value="1" class="flex grow">
        <SourcePanel v-if="active" ref="sourcePanel" />
      </StepPanel>
      <StepPanel v-slot="{ active }" :value="2">
        <MinePanel
          v-if="active"
          :mining-source="$leadminerStore.activeMiningSource!"
        />
      </StepPanel>
      <StepPanel v-slot="{ active }" :value="3">
        <CleanPanel v-if="active" />
      </StepPanel>
    </StepPanels>
  </Stepper>

  <MiningConsentSidebar
    v-model:show="$consentSidebar.status"
    v-model:provider="$consentSidebar.provider"
    v-model:authorize-redirect="$consentSidebar.authorizedRedirect"
  />
  <ImportPstDialog ref="importPstDialogRef" />
</template>

<script setup lang="ts">
import MiningConsentSidebar from '@/components/Mining/MiningConsentSidebar.vue';
import MinePanel from '@/components/Mining/StepperPanels/mine/MinePanel.vue';
import ImportPstDialog from '@/components/Mining/StepperPanels/source/ImportPstDialog.vue';
import SourcePanel from '@/components/Mining/StepperPanels/source/SourcePanel.vue';
import StepWithPopover from '@/components/Mining/StepperPanels/StepWithPopover.vue';
import CleanPanel from '~/components/Mining/StepperPanels/clean/CleanPanel.vue';
import type { MiningSourceType } from '~/types/mining';

const { t } = useI18n({
  useScope: 'local',
});

const $route = useRoute();
const $router = useRouter();
const $stepper = useMiningStepper();
const $consentSidebar = useMiningConsentSidebar();
const $leadminerStore = useLeadminerStore();
const sourcePanel = ref<InstanceType<typeof SourcePanel>>();

const importPstDialogRef = ref();

const { error, provider, source } = $route.query;

const selectedSource = source
  ? $leadminerStore.getMiningSourceByEmail(source as string)
  : null;

if (selectedSource) {
  $leadminerStore.boxes = [];
  $leadminerStore.selectedBoxes = [];
  $leadminerStore.activeMiningSource = selectedSource;
  $stepper.go(2);
} else {
  $stepper.go(1);
}

onNuxtReady(() => {
  if (provider && error === 'oauth-consent') {
    $consentSidebar.show(provider as MiningSourceType, undefined, '/mine');
    if (provider === 'azure') importPstDialogRef.value.openModal();
  }
  $router.replace({ query: undefined });
});
</script>

<i18n lang="json">
{
  "en": {
    "source": "Source",
    "mining": "Mining",
    "cleaning": "Cleaning"
  },
  "fr": {
    "source": "Source",
    "mining": "Extraction",
    "cleaning": "Nettoyage"
  }
}
</i18n>
