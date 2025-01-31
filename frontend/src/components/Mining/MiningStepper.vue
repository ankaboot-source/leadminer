<template>
  <Panel
    v-model:collapsed="collapsePanel"
    class="mb-4 flex flex-col grow"
    :toggleable="isToggleable"
    pt:content:class="flex grow"
    pt:content-container:class="flex grow"
  >
    <template #header>
      <Button
        severity="secondary"
        unstyled
        @click="collapsePanel = !collapsePanel"
      />
    </template>
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

const StepWithPopover = defineAsyncComponent(
  () => import('./StepperPanels/StepWithPopover.vue'),
);

const { t } = useI18n({
  useScope: 'local',
});

const { isToggleable } = defineProps<{
  isToggleable: boolean;
}>();

const $route = useRoute();
const $stepper = useMiningStepper();
const $consentSidebar = useMiningConsentSidebar();
const $leadminerStore = useLeadminerStore();

const collapsePanel = defineModel<boolean>('collapsed');
const sourcePanel = ref<InstanceType<typeof SourcePanel>>();

const { error, provider } = $route.query;

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
    "mine_contacts": "Mine, clean and enrich your contacts",
    "source": "Source",
    "mining": "Mining",
    "cleaning": "Cleaning",
    "retrieving_mailboxes": "Retrieving mailboxes..."
  },
  "fr": {
    "mine_contacts": "Extraire, nettoyer et enrichir vos contacts",
    "source": "Source",
    "mining": "Extraction",
    "cleaning": "Nettoyage",
    "retrieving_mailboxes": "Récupération des boîtes aux lettres..."
  }
}
</i18n>
