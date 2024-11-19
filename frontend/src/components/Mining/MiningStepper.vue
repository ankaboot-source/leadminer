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
            v-if="collapsePanel && $leadminerStore.activeTask"
            v-tooltip.top="spinnerText"
            class="pi pi-spin pi-spinner text-lg"
          />
          {{ t('mine_contacts') }}
        </span>
      </Button>
    </template>
    <Stepper v-model:value="$stepper.index" linear>
      <StepList>
        <Step v-slot="{ active, value }" as-child :value="1">
          <!-- "as" keyword in props breaks syntax highlighting -->
          <!-- prettier-ignore-attribute :step-number -->
          <StepWithTooltip
            :step-number="(value as number)"
            :is-active="active"
            :title="t('source')"
          />
        </Step>
        <Step v-slot="{ active, value }" as-child :value="2">
          <!-- prettier-ignore-attribute :step-number -->
          <StepWithTooltip
            :step-number="(value as number)"
            :is-active="active"
            :title="t('common.mine')"
          />
        </Step>
        <Step v-slot="{ active, value }" as-child :value="3">
          <!-- prettier-ignore-attribute :step-number -->
          <StepWithTooltip
            :step-number="(value as number)"
            :is-active="active"
            :title="t('common.clean')"
          />
        </Step>
        <Step v-slot="{ active, value }" as-child :value="4">
          <!-- prettier-ignore-attribute :step-number -->
          <StepWithTooltip
            :step-number="(value as number)"
            :is-active="active"
            :title="t('common.enrich')"
          />
        </Step>
      </StepList>
      <StepPanels>
        <StepPanel v-slot="{ active }" :value="1">
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
        <StepPanel v-slot="{ active }" :value="4">
          <EnrichPanel v-if="active" />
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
  () => import('./MiningConsentSidebar.vue'),
);
const MinePanel = defineAsyncComponent(
  () => import('./StepperPanels/MinePanel.vue'),
);
const CleanPanel = defineAsyncComponent(
  () => import('./StepperPanels/CleanPanel.vue'),
);
const EnrichPanel = defineAsyncComponent(
  () => import('./StepperPanels/EnrichPanel.vue'),
);

const StepWithTooltip = defineAsyncComponent(
  () => import('./StepperPanels/StepWithPopover.vue'),
);

const { t } = useI18n({
  useScope: 'local',
});

const $route = useRoute();
const $stepper = useMiningStepper();
const $consentSidebar = useMiningConsentSidebar();
const $leadminerStore = useLeadminerStore();

const collapsePanel = defineModel<boolean>('collapsed');
const sourcePanel = ref<InstanceType<typeof SourcePanel>>();

const { error, provider } = $route.query;

const spinnerText = computed(() => {
  if (!(collapsePanel.value && $leadminerStore.activeTask)) return undefined;
  if ($leadminerStore.miningTask !== undefined) {
    return t('mining');
  }
  if ($leadminerStore.isLoadingBoxes) {
    return t('retrieving_mailboxes');
  }
  if (!$leadminerStore.cleaningFinished) {
    return t('cleaning');
  }
  if ($leadminerStore.activeEnrichment) {
    return t('enriching');
  }
  return undefined;
});

onNuxtReady(() => {
  if (provider && error === 'oauth-consent') {
    const newQuery = { ...useRoute().query };
    delete newQuery.provider;
    delete newQuery.error;
    delete newQuery.referrer;
    useRouter().replace({ query: newQuery });
    $consentSidebar.show(provider as MiningSourceType);
  }
});
</script>

<i18n lang="json">
{
  "en": {
    "mine_contacts": "Mine contacts from your email account",
    "source": "Source",
    "mining": "Mining",
    "cleaning": "Cleaning",
    "enriching": "Enriching",
    "retrieving_mailboxes": "Retrieving mailboxes..."
  },
  "fr": {
    "mine_contacts": "Extraire des contacts de votre email",
    "source": "Source",
    "mining": "Extraction",
    "cleaning": "Nettoyage",
    "enriching": "Enrichissement",
    "retrieving_mailboxes": "Récupération des boîtes aux lettres..."
  }
}
</i18n>
