<template>
  <Panel v-model:collapsed="collapsePanel" class="mb-4" toggleable>
    <template #header>
      <Button
        severity="secondary"
        unstyled
        @click="collapsePanel = !collapsePanel"
      >
        <span class="font-semibold flex items-center gap-2">
          <i
            v-if="collapsePanel && activeMining"
            class="pi pi-spin pi-spinner text-lg"
          />
          {{ t('mine_contacts') }}
        </span>
      </Button>
    </template>
    <Stepper v-model:value="$stepper.index" linear>
      <StepList>
        <Step v-tooltip.bottom="t('source')" :value="1">
          <span class="hidden md:block">
            {{ t('source') }}
          </span>
        </Step>
        <Step v-tooltip.bottom="t('common.mine')" :value="2">
          <span class="hidden md:block">
            {{ $t('common.mine') }}
          </span>
        </Step>
        <Step v-tooltip.bottom="t('common.clean')" :value="3">
          <span class="hidden md:block">
            {{ $t('common.clean') }}
          </span>
        </Step>
        <Step v-tooltip.bottom="t('common.enrich')" :value="4">
          <span class="hidden md:block">
            {{ $t('common.enrich') }}
          </span>
        </Step>
      </StepList>
      <StepPanels>
        <StepPanel v-if="$stepper.index === 1" :value="1">
          <SourcePanel ref="sourcePanel" />
        </StepPanel>
        <StepPanel v-if="$stepper.index === 2" :value="2">
          <MinePanel :mining-source="$leadminerStore.activeMiningSource!" />
        </StepPanel>
        <StepPanel v-if="$stepper.index === 3" :value="3">
          <CleanPanel />
        </StepPanel>
        <StepPanel v-if="$stepper.index === 4" :value="4">
          <EnrichPanel />
        </StepPanel>
      </StepPanels>
    </Stepper>
  </Panel>
  <MiningConsentSidebar
    v-model:show="$consentSidebar.status"
    v-model:provider="$consentSidebar.provider"
  />
</template>

<script setup lang="ts">
import SourcePanel from '@/components/Mining/StepperPanels/SourcePanel.vue';
import type { MiningSourceType } from '~/types/mining';

const MiningConsentSidebar = defineAsyncComponent(
  () => import('./MiningConsentSidebar.vue')
);
const MinePanel = defineAsyncComponent(
  () => import('./StepperPanels/MinePanel.vue')
);
const CleanPanel = defineAsyncComponent(
  () => import('./StepperPanels/CleanPanel.vue')
);
const EnrichPanel = defineAsyncComponent(
  () => import('./StepperPanels/EnrichPanel.vue')
);

const { t } = useI18n({
  useScope: 'local',
});

const $route = useRoute();
const $stepper = useMiningStepper();
const $consentSidebar = useMiningConsentSidebar();
const $leadminerStore = useLeadminerStore();
const activeMining = computed(() => $leadminerStore.miningTask !== undefined);

const collapsePanel = defineModel<boolean>('collapsed');

const sourcePanel = ref<InstanceType<typeof SourcePanel>>();
const { error, provider, source } = $route.query;

onNuxtReady(() => {
  if (error ?? provider ?? source) {
    useRouter().replace({ query: {} });
  }
  if (source) {
    collapsePanel.value = false;
    sourcePanel.value?.selectSource(source as string);
  } else if (error === 'oauth-consent') {
    $consentSidebar.show(provider as MiningSourceType);
  }
});
</script>

<i18n lang="json">
{
  "en": {
    "mine_contacts": "Mine contacts from your email account",
    "source": "Source"
  },
  "fr": {
    "mine_contacts": "Extraire des contacts de votre email",
    "source": "Source"
  }
}
</i18n>
